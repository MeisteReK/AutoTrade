from typing import Optional, List
from pathlib import Path
import json
import threading
import logging
import os

import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, Query, HTTPException, status, Request, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.types import Message

# Załaduj zmienne środowiskowe
load_dotenv()

from .db import Base, engine, get_db
from . import schemas, crud
from . import exceptions

from sqlalchemy import select, func
from .models import Listing, User, SavedValuation, SavedComparison
from .scraper_integration import run_full_update, load_status, save_status, cancel_update, SCRAPER_LOG_FILE, is_process_running, load_history, import_csv_to_database
from .auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_active_user,
    get_current_admin_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

logger = logging.getLogger(__name__)




# Tworzymy tabele w bazie (jeśli nie istnieją)
Base.metadata.create_all(bind=engine)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware z nagłówkami bezpieczeństwa."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Wyłącz restrykcyjne nagłówki dla Swagger UI (/docs, /redoc, /openapi.json)
        if request.url.path.startswith(("/docs", "/redoc", "/openapi.json")):
            # Dla Swagger UI używamy mniej restrykcyjnych nagłówków
            response.headers["X-Content-Type-Options"] = "nosniff"
            # Nie ustawiamy X-Frame-Options dla Swagger (może być potrzebne)
            # Nie ustawiamy CSP dla Swagger (blokuje zasoby)
            return response
        
        # Security headers dla reszty endpointów
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' http://localhost:* http://127.0.0.1:*;"
        )
        response.headers["Content-Security-Policy"] = csp
        
        return response

# Rate limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="AutoTrade Analytics API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(exceptions.AutoTradeException)
async def autotrade_exception_handler(request: Request, exc: exceptions.AutoTradeException):
    """Handler dla wyjątków aplikacji."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "error_code": exc.error_code,
            "detail": exc.detail,
            "path": str(request.url.path)
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handler dla HTTPException."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "error_code": "HTTP_ERROR",
            "detail": exc.detail,
            "path": str(request.url.path)
        },
        headers=exc.headers
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handler dla nieobsłużonych wyjątków."""
    logger.error(f"Nieobsłużony wyjątek: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "error_code": "INTERNAL_SERVER_ERROR",
            "detail": "Wystąpił nieoczekiwany błąd serwera. Skontaktuj się z administratorem.",
            "path": str(request.url.path)
        }
    )

app.add_middleware(SecurityHeadersMiddleware)
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === KONFIGURACJA ŚCIEŻEK ===

BASE_DIR = Path(__file__).resolve().parent.parent  # katalog backend/
BACKEND_DIR = BASE_DIR  # alias dla czytelności
MODELS_DIR = BASE_DIR / "models"
SCRAPER_CONFIG_FILE = BACKEND_DIR / "scraper_config.json"

# === MODEL REGRESJI ===
# Model jest trenowany na żądanie dla każdej wyceny (dla konkretnej marki/modelu).
# To zapewnia najwyższą dokładność i aktualność przy czasie trenowania ~5-20 sekund.
# Stary globalny model (price_regression.pkl) nie jest już używany.


@app.get("/health")
def health():
    return {
        "message": "AutoTrade Analytics API działa",
        "db_url": str(engine.url),
    }


# ================== AUTENTYKACJA ==================

@app.post("/auth/register", response_model=schemas.UserResponse)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Rejestracja nowego użytkownika."""
    # Sprawdź czy użytkownik już istnieje
    if db.query(User).filter(User.username == user_data.username).first():
        raise exceptions.ConflictError("Użytkownik o tej nazwie już istnieje")
    if db.query(User).filter(User.email == user_data.email).first():
        raise exceptions.ConflictError("Użytkownik o tym adresie email już istnieje")
    
    # Utwórz użytkownika
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role="user"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return schemas.UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role
    )


@app.post("/auth/login", response_model=schemas.Token)
@limiter.limit(os.getenv("LOGIN_RATE_LIMIT_PER_MINUTE", "5") + "/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    """Logowanie użytkownika."""
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise exceptions.AuthenticationError("Nieprawidłowa nazwa użytkownika lub hasło")
    
    if not user.is_active:
        raise exceptions.AuthenticationError("Konto użytkownika jest nieaktywne")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return schemas.Token(
        access_token=access_token,
        token_type="bearer",
        user=schemas.UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            role=user.role
        )
    )


@app.get("/auth/me", response_model=schemas.UserResponse)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Zwraca dane aktualnego użytkownika."""
    return schemas.UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role
    )


# Stare endpointy - usunięte, bo model jest trenowany na żądanie
# @app.get("/valuation/status") - USUNIĘTY
# @app.post("/valuation/reload-model") - USUNIĘTY


@app.get("/brands", response_model=list[str])
def get_brands(db: Session = Depends(get_db)):
    """
    Zwraca listę dostępnych marek (vehicle_brand) z tabeli listings.
    """
    return crud.get_brands(db)


@app.get("/models", response_model=list[str])
def get_models(
    brand: str = Query(..., description="Nazwa marki, np. 'Abarth'"),
    db: Session = Depends(get_db),
):
    """
    Zwraca listę modeli dla podanej marki.
    """
    return crud.get_models_by_brand(db, brand)


@app.get("/generations", response_model=list[str])
def get_generations(
    brand: str = Query(..., description="Nazwa marki"),
    model: str = Query(..., description="Nazwa modelu"),
    db: Session = Depends(get_db),
):
    """
    Zwraca listę generacji dla podanej marki i modelu.
    Zwraca tylko generacje, które mają vehicle_generation != NULL.
    """
    return crud.get_generations_by_brand_model(db, brand, model)


@app.get("/displacements", response_model=list[float])
def get_displacements(
    brand: str = Query(..., description="Nazwa marki"),
    model: str = Query(..., description="Nazwa modelu"),
    db: Session = Depends(get_db),
):
    """
    Zwraca listę unikalnych pojemności silnika (cm³) dla podanej marki i modelu.
    """
    return crud.get_displacements_by_brand_model(db, brand, model)


@app.get("/fuel-types-by-model", response_model=list[str])
def get_fuel_types_by_model(
    brand: str = Query(..., description="Nazwa marki"),
    model: str = Query(..., description="Nazwa modelu"),
    db: Session = Depends(get_db),
):
    """
    Zwraca listę unikalnych typów paliwa dla podanej marki i modelu.
    """
    return crud.get_fuel_types_by_brand_model(db, brand, model)

@app.get("/fuel-types", response_model=list[str])
def get_fuel_types(db: Session = Depends(get_db)):
    """
    Zwraca listę dostępnych rodzajów paliwa (fuel_type) z tabeli listings.
    """
    return crud.get_fuel_types(db)


@app.get("/transmissions", response_model=list[str])
def get_transmissions(db: Session = Depends(get_db)):
    """
    Zwraca listę dostępnych typów skrzyń biegów (transmission) z tabeli listings.
    """
    return crud.get_transmissions(db)


@app.get("/publication-date-range")
def get_publication_date_range(db: Session = Depends(get_db)):
    """
    Zwraca zakres dat publikacji ogłoszeń w bazie (min_date, max_date).
    Daty w formacie DD.MM.YYYY.
    """
    min_date, max_date = crud.get_publication_date_range(db)
    return {
        "min_date": min_date,
        "max_date": max_date,
    }



@app.get("/analytics/price-statistics", response_model=schemas.PriceStatisticsResponse)
def get_price_statistics(
    brand: Optional[str] = None,
    model: Optional[str] = None,
    generation: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    mileage_max: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Zwraca szczegółowe statystyki cen: średnia, mediana, odchylenie standardowe, kwartyle (Q1, Q3).
    """
    stats = crud.get_price_statistics(
        db, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type
    )
    
    filters = {}
    if brand:
        filters["brand"] = brand
    if model:
        filters["model"] = model
    if generation:
        filters["generation"] = generation
    if year_min is not None:
        filters["year_min"] = year_min
    if year_max is not None:
        filters["year_max"] = year_max
    if mileage_max is not None:
        filters["mileage_max"] = mileage_max
    if date_from:
        filters["date_from"] = date_from
    if date_to:
        filters["date_to"] = date_to
    
    return schemas.PriceStatisticsResponse(
        filters=filters,
        **stats
    )


@app.get("/analysis", response_model=schemas.AnalysisResult)
def get_analysis(
    brand: Optional[str] = None,
    model: Optional[str] = None,
    generation: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    mileage_max: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Zwraca statystyki (liczba ofert, średnia, min, max) dla zadanych filtrów.
    date_from i date_to w formacie DD.MM.YYYY.
    """
    n_offers, avg_price, min_price, max_price = crud.get_analysis(
        db, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type
    )

    filters = {
        "brand": brand,
        "model": model,
        "generation": generation,
        "year_min": year_min,
        "year_max": year_max,
        "mileage_max": mileage_max,
        "date_from": date_from,
        "date_to": date_to,
        "displacement_min": displacement_min,
        "displacement_max": displacement_max,
        "fuel_type": fuel_type,
    }

    return schemas.AnalysisResult(
        filters=filters,
        n_offers=n_offers,
        avg_price=avg_price,
        min_price=min_price,
        max_price=max_price,
    )


@app.get("/listings-filtered", response_model=schemas.ListingsResponse)
def get_listings_filtered(
    brand: Optional[str] = None,
    model: Optional[str] = None,
    generation: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    mileage_max: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_by: Optional[str] = Query(
        None, description="year | mileage | price | brand | model"
    ),
    sort_dir: str = Query("desc", description="asc | desc"),
    db: Session = Depends(get_db),
):
    """
    Zwraca listę ofert z paginacją i sortowaniem po CAŁEJ bazie
    (sort_by: year/mileage/price, sort_dir: asc/desc).
    """
    total, items = crud.get_listings_filtered(
        db, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type, limit, offset, sort_by, sort_dir
    )

    filters = {
        "brand": brand,
        "model": model,
        "generation": generation,
        "year_min": year_min,
        "year_max": year_max,
        "mileage_max": mileage_max,
        "date_from": date_from,
        "date_to": date_to,
        "displacement_min": displacement_min,
        "displacement_max": displacement_max,
    }

    return schemas.ListingsResponse(
        filters=filters,
        limit=limit,
        offset=offset,
        total=total,
        items=items,
    )


@app.get("/trend-by-year", response_model=schemas.TrendResponse)
def get_trend_by_year(
    brand: Optional[str] = None,
    model: Optional[str] = None,
    generation: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    mileage_max: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Zwraca trend średniej ceny wg roku produkcji (do wykresu liniowego).
    date_from i date_to w formacie DD.MM.YYYY.
    """
    points_raw = crud.get_trend_by_year(
        db, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type
    )

    filters = {
        "brand": brand,
        "model": model,
        "generation": generation,
        "year_min": year_min,
        "year_max": year_max,
        "mileage_max": mileage_max,
        "date_from": date_from,
        "date_to": date_to,
    }

    return schemas.TrendResponse(
        filters=filters,
        points=[
            schemas.TrendPoint(**p)
            for p in points_raw
        ],
    )


def load_training_data(filters: Optional[schemas.ValuationTrainingFilters], db: Session) -> pd.DataFrame:
    """Pobiera dane do treningu zgodnie z filtrami."""
    from .models import Listing
    
    stmt = select(
        Listing.vehicle_brand,
        Listing.vehicle_model,
        Listing.vehicle_generation,
        Listing.production_year,
        Listing.mileage_km,
        Listing.fuel_type,
        Listing.transmission,
        Listing.displacement_cm3,
        Listing.price_pln,
    )
    
    # Zastosuj filtry używając funkcji pomocniczej
    if filters:
        stmt = crud.apply_filters(
            stmt,
            brand=filters.brand,
            model=filters.model,
            generation=filters.generation,
            year_min=filters.year_min,
            year_max=filters.year_max,
            mileage_max=filters.mileage_max,
            displacement_min=filters.displacement_min,
            displacement_max=filters.displacement_max,
            fuel_type=filters.fuel_type,
            date_from=filters.date_from,
            date_to=filters.date_to,
        )
    
    # Filtruj tylko kompletne rekordy
    stmt = stmt.where(
        Listing.price_pln.isnot(None),
        Listing.mileage_km.isnot(None),
        Listing.production_year.isnot(None),
        Listing.displacement_cm3.isnot(None),
    )
    
    df = pd.read_sql(stmt, db.bind)
    
    # Przekształć do formatu modelu
    if not df.empty:
        df = df.rename(columns={
            "vehicle_brand": "brand",
            "vehicle_model": "model",
            "vehicle_generation": "generation",
            "production_year": "year",
            "displacement_cm3": "engine_capacity_cm3",
        })
        df["generation"] = df["generation"].fillna("Unknown")
        
        # Podstawowe sanity-checki
        df = df[(df["year"] >= 1990) & (df["year"] <= 2025)]
        df = df[(df["mileage_km"] >= 0) & (df["mileage_km"] <= 800_000)]
        df = df[(df["engine_capacity_cm3"] >= 500) & (df["engine_capacity_cm3"] <= 8000)]
        df = df[(df["price_pln"] >= 1000) & (df["price_pln"] <= 1_000_000)]
    
    return df


def train_custom_model(
    df: pd.DataFrame,
    model_type: str,
    features_numeric: List[str],
    features_categorical: List[str],
    alpha: Optional[float] = None,
    n_estimators: Optional[int] = None,
    max_depth: Optional[int] = None,
    min_samples_split: Optional[int] = None,
    min_samples_leaf: Optional[int] = None,
    test_size: float = 0.2,
    random_state: int = 42,
) -> tuple:
    """Trenuje model z podanymi parametrami i zwraca (model, metrics)."""
    from sklearn.linear_model import LinearRegression, Ridge, Lasso
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler, OneHotEncoder
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    import numpy as np
    
    if df.empty or len(df) < 10:
        raise ValueError("Za mało danych do treningu modelu (minimum 10 rekordów)")
    
    target_col = "price_pln"
    available_features = features_numeric + features_categorical
    
    missing_features = [f for f in available_features if f not in df.columns]
    if missing_features:
        raise ValueError(f"Brakujące cechy w danych: {missing_features}")
    
    required_cols = available_features + [target_col]
    df_clean = df[required_cols].dropna()
    
    if len(df_clean) < 10:
        raise ValueError("Za mało danych po usunięciu brakujących wartości")
    
    X = df_clean[available_features]
    y = df_clean[target_col]
    
    numeric_transformer = Pipeline([
        ("scaler", StandardScaler()),
    ])
    
    categorical_transformer = Pipeline([
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    
    preprocessor = ColumnTransformer([
        ("num", numeric_transformer, [f for f in features_numeric if f in X.columns]),
        ("cat", categorical_transformer, [f for f in features_categorical if f in X.columns]),
    ])
    if model_type == "linear":
        regressor = LinearRegression()
    elif model_type == "ridge":
        regressor = Ridge(alpha=alpha or 1.0, random_state=random_state)
    elif model_type == "lasso":
        regressor = Lasso(alpha=alpha or 1.0, random_state=random_state, max_iter=10000)
    elif model_type == "random_forest":
        regressor = RandomForestRegressor(
            n_estimators=n_estimators or 200,
            max_depth=max_depth,
            min_samples_split=min_samples_split or 2,
            min_samples_leaf=min_samples_leaf or 1,
            random_state=random_state,
            n_jobs=-1,
        )
    else:
        raise ValueError(f"Nieznany typ modelu: {model_type}")
    
    model = Pipeline([
        ("preprocess", preprocessor),
        ("regressor", regressor),
    ])
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=test_size,
        random_state=random_state
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    r2 = float(r2_score(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    mae = float(mean_absolute_error(y_test, y_pred))
    
    metrics = {
        "r2": r2,
        "rmse": rmse,
        "mae": mae,
        "n_samples": int(len(df_clean)),
        "test_size": test_size,
        "features_numeric": features_numeric,
        "features_categorical": features_categorical,
        "target": target_col,
    }
    
    return model, metrics


@app.post("/valuation", response_model=schemas.ValuationResponse)
def valuation(request: schemas.ValuationRequest, db: Session = Depends(get_db)):
    """Wycena pojazdu."""
    vehicle_data = pd.DataFrame([
        {
            "brand": request.brand,
            "model": request.model,
            "generation": request.generation if request.generation else "Unknown",
            "year": request.year,
            "mileage_km": request.mileage_km,
            "fuel_type": request.fuel_type,
            "transmission": request.transmission,
            "engine_capacity_cm3": request.engine_capacity_cm3,
        }
    ])
    
    
    # Ustaw domyślną konfigurację jeśli nie podano
    if request.valuation_model_config is None:
        model_config_obj = schemas.ValuationModelConfig(model_type="random_forest")
    else:
        model_config_obj = request.valuation_model_config
    
        try:
            if not request.training_filters or not request.training_filters.brand:
                raise exceptions.ValidationError(
                    "Niestandardowy model wymaga podania marki pojazdu. Marka jest automatycznie ustawiana na podstawie wycenianego pojazdu.",
                    field="training_filters.brand"
                )
            
            df = load_training_data(request.training_filters, db)
            
            if df.empty:
                raise exceptions.NotFoundError(
                    "Dane do treningu modelu",
                    resource_id="zgodnie z podanymi filtrami"
                )
            
            if len(df) > 50000:
                raise exceptions.ValidationError(
                    f"Zbyt duży zbiór danych ({len(df):,} rekordów). Ogranicz filtry do konkretnego modelu lub dodaj więcej filtrów (maksymalnie 50,000 rekordów).",
                    field="training_filters"
                )
            
            features_numeric = model_config_obj.features_numeric or ["year", "mileage_km", "engine_capacity_cm3"]
            features_categorical = model_config_obj.features_categorical or ["brand", "model", "generation", "fuel_type", "transmission"]
            model, metrics_dict = train_custom_model(
                df=df,
                model_type=model_config_obj.model_type,
                features_numeric=features_numeric,
                features_categorical=features_categorical,
                alpha=model_config_obj.alpha,
                n_estimators=model_config_obj.n_estimators,
                max_depth=model_config_obj.max_depth,
                min_samples_split=model_config_obj.min_samples_split,
                min_samples_leaf=model_config_obj.min_samples_leaf,
                test_size=model_config_obj.test_size or 0.2,
                random_state=model_config_obj.random_state or 42,
            )
            
            # Wykonaj wycenę
            pred = float(model.predict(vehicle_data)[0])
            metrics = schemas.ValuationModelMetrics(**metrics_dict)
            
        except ValueError as e:
            raise exceptions.ValidationError(str(e))
        except Exception as e:
            logger.error(f"Błąd podczas treningu modelu: {e}", exc_info=True)
            raise exceptions.ModelTrainingError(f"Błąd podczas treningu modelu: {str(e)}")

    return schemas.ValuationResponse(
        predicted_price=pred,
        model_metrics=metrics,
    )


@app.post("/compare/vehicles", response_model=schemas.VehicleComparisonResponse)
def compare_vehicles(
    request: schemas.CompareVehiclesRequest,
    db: Session = Depends(get_db),
):
    """
    Porównuje dwa pojazdy na podstawie filtrów.
    Zwraca metryki, trend cenowy i dane cena vs przebieg dla obu pojazdów.
    """
    vehicle_a_dict = request.vehicle_a.model_dump(exclude_none=True)
    vehicle_b_dict = request.vehicle_b.model_dump(exclude_none=True)
    
    comparison_data = crud.get_vehicle_comparison(
        db, vehicle_a_dict, vehicle_b_dict
    )
    
    return schemas.VehicleComparisonResponse(**comparison_data)


@app.get("/analytics/price-mileage", response_model=schemas.PriceMileageResponse)
def get_price_mileage(
    brand: Optional[str] = None,
    model: Optional[str] = None,
    generation: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    mileage_max: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
    limit: int = Query(100000, ge=1, le=200000),  # Zwiększony limit dla pełnych danych
    db: Session = Depends(get_db),
):
    """
    Zwraca dane do wykresu scatter: cena vs przebieg.
    date_from i date_to w formacie DD.MM.YYYY.
    """
    points_raw = crud.get_price_mileage_data(
        db, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type, limit
    )

    filters = {
        "brand": brand,
        "model": model,
        "generation": generation,
        "year_min": year_min,
        "year_max": year_max,
        "mileage_max": mileage_max,
        "date_from": date_from,
        "date_to": date_to,
        "displacement_min": displacement_min,
        "displacement_max": displacement_max,
    }

    return schemas.PriceMileageResponse(
        filters=filters,
        points=[schemas.PriceMileagePoint(**p) for p in points_raw],
    )


@app.get("/analytics/price-stats-by-category", response_model=schemas.PriceStatsByCategoryResponse)
def get_price_stats_by_category(
    brand: Optional[str] = None,
    model: Optional[str] = None,
    generation: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    mileage_max: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Zwraca statystyki cen (średnia, mediana) wg paliwa i skrzyni biegów.
    date_from i date_to w formacie DD.MM.YYYY.
    """
    by_fuel_raw, by_trans_raw = crud.get_price_stats_by_category(
        db, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type
    )

    filters = {
        "brand": brand,
        "model": model,
        "generation": generation,
        "year_min": year_min,
        "year_max": year_max,
        "mileage_max": mileage_max,
        "date_from": date_from,
        "date_to": date_to,
        "displacement_min": displacement_min,
        "displacement_max": displacement_max,
    }

    return schemas.PriceStatsByCategoryResponse(
        filters=filters,
        by_fuel_type=[schemas.PriceStatsByCategory(**item) for item in by_fuel_raw],
        by_transmission=[schemas.PriceStatsByCategory(**item) for item in by_trans_raw],
    )


# ================== ADMIN ENDPOINTS - AKTUALIZACJA BAZY ==================

# Uproszczone: używamy tylko pliku JSON do zarządzania stanem
# Nie potrzebujemy zmiennych globalnych - status jest w pliku


def update_task():
    """Background task dla aktualizacji - uruchamiany w osobnym wątku."""
    # Ta funkcja jest używana tylko dla kompatybilności wstecznej
    # Nowa funkcja to update_task_with_step()
    update_task_with_step("scraping")


def update_task_with_step(start_step: str, steps_to_run: Optional[List[str]] = None):
    """Wrapper dla update_task z parametrem start_step."""
    # Sprawdź status z pliku (jeden źródło prawdy)
    current_status = load_status()
    if current_status["status"] == "running":
        logger.warning("Update already running (status from file), skipping")
        return
    
    try:
        results = run_full_update(start_step=start_step, steps_to_run=steps_to_run)
        logger.info(f"Update completed: {results['status']}")
    except Exception as e:
        logger.error(f"Update failed: {e}")
        # Status zostanie zaktualizowany w run_full_update()
        raise


@app.post("/admin/database/full-update")
def trigger_full_update(
    request: schemas.StartUpdateRequest = schemas.StartUpdateRequest(),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Uruchamia aktualizację w tle.
    Można wybrać od którego etapu zacząć.
    Wymaga uprawnień administratora.
    """
    # Sprawdź czy już działa (jeden źródło prawdy - plik JSON)
    current_status = load_status()
    if current_status["status"] == "running":
        raise HTTPException(
            status_code=400,
            detail="Update already in progress. Check status endpoint for details."
        )
    
    start_step = request.start_step or "scraping"
    steps_to_run = request.steps_to_run
    
    thread = threading.Thread(target=lambda: update_task_with_step(start_step, steps_to_run), daemon=True)
    thread.start()
    
    step_names = {
        "scraping": "Scrapowanie",
        "processing": "Przetwarzanie danych",
        "database_update": "Aktualizacja bazy danych",
    }
    
    return {
        "message": f"Aktualizacja uruchomiona od etapu: {step_names.get(start_step, start_step)}",
        "status": "processing",
        "start_step": start_step,
        "estimated_duration": "zależy od wybranego etapu",
        "note": "Use /admin/database/update-status to check progress"
    }


@app.get("/admin/database/update-status")
def get_update_status(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Zwraca aktualny status aktualizacji.
    Status jest zapisywany do pliku, więc przetrwa restart serwera.
    Wymaga uprawnień administratora.
    """
    from datetime import datetime
    
    status = load_status()
    
    # Dodatkowe informacje
    response = {
        **status,
        "is_running": status["status"] == "running",
        "can_start_new": status["status"] in ["idle", "completed", "failed"]
    }
    
    # Oblicz czas trwania jeśli proces jest uruchomiony
    if status["status"] == "running" and status.get("started_at"):
        try:
            started = datetime.fromisoformat(status["started_at"])
            duration = datetime.utcnow() - started
            response["duration_seconds"] = int(duration.total_seconds())
            response["duration_hours"] = round(duration.total_seconds() / 3600, 2)
        except:
            pass
    
    return response


@app.get("/admin/database/update-history")
def get_update_history(
    current_user: User = Depends(get_current_admin_user),
    limit: int = Query(20, ge=1, le=100, description="Maksymalna liczba rekordów do zwrócenia"),
    offset: int = Query(0, ge=0, description="Przesunięcie (paginacja)")
):
    """
    Zwraca historię wszystkich scrapów z paginacją.
    Wymaga uprawnień administratora.
    """
    from datetime import datetime
    
    history = load_history()
    total = len(history)
    
    # Oblicz czas trwania dla każdego rekordu
    for record in history:
        if record.get("started_at") and record.get("completed_at"):
            try:
                started = datetime.fromisoformat(record["started_at"])
                completed = datetime.fromisoformat(record["completed_at"])
                duration = completed - started
                record["duration_seconds"] = int(duration.total_seconds())
                record["duration_hours"] = round(duration.total_seconds() / 3600, 2)
            except:
                pass
        elif record.get("started_at") and record.get("status") == "running":
            try:
                started = datetime.fromisoformat(record["started_at"])
                duration = datetime.utcnow() - started
                record["duration_seconds"] = int(duration.total_seconds())
                record["duration_hours"] = round(duration.total_seconds() / 3600, 2)
            except:
                pass
    
    # Paginacja
    paginated_history = history[offset:offset + limit]
    
    return {
        "history": paginated_history,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@app.delete("/admin/database/update-history/{record_id}")
def delete_history_record(
    record_id: str,
    current_user: User = Depends(get_current_admin_user)
):
    """
    Usuwa rekord z historii.
    Wymaga uprawnień administratora.
    """
    from app.scraper_integration import load_history, HISTORY_FILE
    import json
    
    history = load_history()
    
    # Znajdź i usuń rekord
    original_length = len(history)
    history = [record for record in history if record.get("id") != record_id]
    
    if len(history) == original_length:
        raise HTTPException(
            status_code=404,
            detail=f"Record with ID {record_id} not found"
        )
    
    # Zapisz zaktualizowaną historię
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)
        
        return {
            "message": "Record deleted successfully",
            "deleted_id": record_id
        }
    except Exception as e:
        logger.error(f"Error deleting history record: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting record: {str(e)}"
        )


@app.post("/admin/database/import-csv")
def import_csv_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Importuje plik CSV do bazy danych.
    Wymaga uprawnień administratora.
    """
    import tempfile
    
    # Sprawdź czy plik to CSV
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="File must be a CSV file"
        )
    
    # Zapisz plik tymczasowo
    tmp_path = None
    try:
        # Utwórz plik tymczasowy
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp_file:
            tmp_path = Path(tmp_file.name)
            # Zapisz zawartość pliku
            content = file.file.read()
            tmp_path.write_bytes(content)
        
        # Zamknij plik przed importem (ważne w Windows)
        # Importuj do bazy
        stats = import_csv_to_database(tmp_path)
        
        # Zapisz do historii
        from datetime import datetime
        import uuid
        from app.scraper_integration import save_status
        
        history_record = {
            "id": str(uuid.uuid4()),
            "status": "completed",
            "current_step": None,
            "progress_percent": 100,
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat(),
            "error_message": None,
            "steps_completed": ["database_update"],
            "steps_failed": [],
            "steps_to_run": ["database_update"],
            "start_step": "database_update",
            "n_offers_scraped": stats.get("total_processed", 0),
            "import_type": "csv_upload",
            "import_filename": file.filename,
            "import_stats": stats
        }
        save_status(history_record)
        
        return {
            "message": "CSV imported successfully",
            "stats": stats
        }
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error importing CSV: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error importing CSV: {str(e)}"
        )
    finally:
        # Usuń plik tymczasowy po zamknięciu wszystkich uchwytów
        if tmp_path and tmp_path.exists():
            try:
                # W Windows czasami trzeba poczekać aż plik zostanie zwolniony
                import time
                import gc
                gc.collect()
                time.sleep(0.1)
                tmp_path.unlink()
            except PermissionError:
                # Jeśli nie można usunąć, spróbuj później (Windows może trzymać plik przez chwilę)
                logger.warning(f"Could not delete temporary file {tmp_path}, will be cleaned up by system")
            except Exception as e:
                logger.warning(f"Error deleting temporary file {tmp_path}: {e}")


@app.post("/admin/database/cancel-update")
def cancel_update_endpoint(
    current_user: User = Depends(get_current_admin_user)
):
    """
    Anuluje uruchomiony proces aktualizacji.
    Wymaga uprawnień administratora.
    """
    status = load_status()
    
    logger.info(f"Cancel request received. Current status: {status.get('status')}")
    
    # Pozwól anulować nawet jeśli status nie jest "running" (może być w trakcie uruchamiania)
    if status["status"] not in ["running", "idle"]:
        logger.warning(f"Cannot cancel: status is '{status.get('status')}'")
        # Nie rzucaj błędu, po prostu spróbuj anulować
        # return {"message": f"Cannot cancel: status is '{status.get('status')}'"}
    
    try:
        cancel_update()
        # Odśwież status po anulowaniu
        status = load_status()
        logger.info(f"Cancel completed. New status: {status.get('status')}")
        return {
            "message": "Update process cancelled successfully",
            "status": status.get("status")
        }
    except Exception as e:
        logger.error(f"Error cancelling update: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Error cancelling update: {str(e)}"
        )


@app.post("/admin/database/reset-status")
def reset_status(
    current_user: User = Depends(get_current_admin_user),
    force: bool = Query(False, description="Force reset even if status is 'running' (use when process is hung)")
):
    """
    Resetuje status do 'idle' (tylko jeśli proces nie jest uruchomiony).
    Jeśli force=True, resetuje nawet jeśli status jest "running" (użyj gdy proces się zawiesił).
    Wymaga uprawnień administratora.
    """
    status = load_status()
    
    # Sprawdź czy proces faktycznie działa
    process_running = is_process_running()
    
    if status["status"] == "running" and not force:
        if process_running:
            raise HTTPException(
                status_code=400,
                detail="Cannot reset status while update is running. Use cancel-update endpoint first, or use force=true if process is hung."
            )
        else:
            # Proces się zawiesił - pozwól na reset
            logger.warning("Status is 'running' but process is not active - allowing reset (process may have hung)")
    
    new_status = {
        "status": "idle",
        "current_step": None,
        "progress_percent": 0,
        "started_at": None,
        "completed_at": None,
        "error_message": None,
        "steps_completed": [],
        "steps_failed": []
    }
    save_status(new_status)
    
    return {"message": "Status reset to idle"}


@app.delete("/admin/listings/{listing_id}")
def delete_listing(
    listing_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Usuwa rekord z tabeli ofert.
    Wymaga uprawnień administratora.
    """
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    db.delete(listing)
    db.commit()
    return {"message": "Listing deleted successfully"}


# === Admin - Konfiguracja scrapera ===

def get_default_scraper_config() -> dict:
    """Zwraca domyślną konfigurację scrapera."""
    return {
        "max_workers": 2,
        "request_timeout": 15,
        "delay_between_offers_min": 0.8,  # Bezpieczne ustawienie domyślne
        "delay_between_offers_max": 1.5,  # Bezpieczne ustawienie domyślne
        "delay_between_pages_min": 1.5,    # Bezpieczne ustawienie domyślne
        "delay_between_pages_max": 3.0,    # Bezpieczne ustawienie domyślne
        "max_offers_per_brand": None,
        "brands_to_scrape": [
            "abarth", "alfa-romeo", "audi", "bmw", "chevrolet", "citroen",
            "dacia", "fiat", "ford", "honda", "hyundai", "kia", "mazda",
            "mercedes-benz", "nissan", "opel", "peugeot", "renault", "seat",
            "skoda", "toyota", "volkswagen", "volvo"
        ],
        "date_from": None,
        "date_to": None
    }


def load_scraper_config() -> dict:
    """Wczytuje konfigurację scrapera z pliku."""
    if SCRAPER_CONFIG_FILE.exists():
        try:
            with open(SCRAPER_CONFIG_FILE, "r", encoding="utf-8") as f:
                config = json.load(f)
                # Upewnij się, że wszystkie wymagane pola są obecne
                default = get_default_scraper_config()
                for key in default:
                    if key not in config:
                        config[key] = default[key]
                return config
        except Exception as e:
            logger.error(f"Error loading scraper config: {e}")
    return get_default_scraper_config()


def save_scraper_config(config: dict):
    """Zapisuje konfigurację scrapera do pliku."""
    try:
        SCRAPER_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SCRAPER_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving scraper config: {e}")
        raise HTTPException(status_code=500, detail=f"Błąd zapisu konfiguracji: {e}")


@app.get("/admin/scraper/config", response_model=schemas.ScraperConfig)
def get_scraper_config(
    current_user: User = Depends(get_current_admin_user)
):
    """Pobiera aktualną konfigurację scrapera."""
    config = load_scraper_config()
    return schemas.ScraperConfig(**config)


@app.get("/admin/scraper/config/default", response_model=schemas.ScraperConfig)
def get_default_config(
    current_user: User = Depends(get_current_admin_user)
):
    """Zwraca domyślną konfigurację scrapera."""
    return schemas.ScraperConfig(**get_default_scraper_config())


@app.post("/admin/scraper/config", response_model=schemas.ScraperConfig)
def update_scraper_config(
    config: schemas.ScraperConfig,
    current_user: User = Depends(get_current_admin_user)
):
    """Zapisuje nową konfigurację scrapera."""
    # Sprawdź czy proces jest uruchomiony
    status = load_status()
    if status["status"] == "running":
        raise HTTPException(
            status_code=400,
            detail="Nie można zmienić konfiguracji podczas uruchomionego procesu aktualizacji"
        )
    
    config_dict = config.model_dump()
    save_scraper_config(config_dict)
    logger.info(f"Scraper config updated by {current_user.username}")
    return schemas.ScraperConfig(**config_dict)


@app.get("/admin/scraper/config/stats")
def get_scraper_config_stats(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Zwraca szacunkowe statystyki na podstawie aktualnej konfiguracji scrapera.
    Pomaga oszacować ile ofert może być pobranych i jak długo to potrwa.
    """
    config = load_scraper_config()
    brands = config.get("brands_to_scrape", [])
    date_from = config.get("date_from")
    date_to = config.get("date_to")
    max_offers_per_brand = config.get("max_offers_per_brand")
    
    total_offers_in_db = 0
    total_offers_to_scrape = 0
    brand_stats = {}
    
    for brand in brands:
        count_stmt = select(func.count(Listing.id)).where(Listing.vehicle_brand == brand.capitalize())
        
        if date_from or date_to:
            count_stmt = crud.apply_filters(
                count_stmt,
                brand=brand.capitalize(),
                model=None,
                generation=None,
                year_min=None,
                year_max=None,
                mileage_max=None,
                date_from=date_from,
                date_to=date_to
            )
        
        brand_count_in_db = db.execute(count_stmt).scalar() or 0
        total_offers_in_db += brand_count_in_db
        
        if max_offers_per_brand is not None and max_offers_per_brand > 0:
            brand_count_to_scrape = min(brand_count_in_db, max_offers_per_brand)
        else:
            brand_count_to_scrape = brand_count_in_db
        
        brand_stats[brand] = {
            "in_database": brand_count_in_db,
            "to_scrape": brand_count_to_scrape
        }
        total_offers_to_scrape += brand_count_to_scrape
    
    delay_between_offers_min = config.get("delay_between_offers_min", 0.8)
    delay_between_offers_max = config.get("delay_between_offers_max", 1.5)
    delay_between_pages_min = config.get("delay_between_pages_min", 1.5)
    delay_between_pages_max = config.get("delay_between_pages_max", 3.0)
    max_workers = config.get("max_workers", 2)
    
    avg_delay_between_offers = (delay_between_offers_min + delay_between_offers_max) / 2
    offers_per_page = 25
    avg_delay_between_pages = (delay_between_pages_min + delay_between_pages_max) / 2
    total_pages = 0
    for brand in brands:
        brand_offers = brand_stats[brand]["to_scrape"]
        if brand_offers > 0:
            brand_pages = (brand_offers + offers_per_page - 1) // offers_per_page  # Zaokrąglenie w górę
            total_pages += brand_pages
    
    # Szacunkowy czas: (czas na oferty) + (czas na przejście między stronami)
    # Uwzględniamy równoległość (max_workers)
    time_per_offer = avg_delay_between_offers / max_workers  # Równoległe wątki
    time_for_offers = total_offers_to_scrape * time_per_offer
    
    time_per_page = avg_delay_between_pages / max_workers  # Równoległe wątki
    time_for_pages = total_pages * time_per_page
    
    total_time_seconds = time_for_offers + time_for_pages
    estimated_hours = total_time_seconds / 3600
    
    return {
        "total_estimated_offers": total_offers_to_scrape,
        "total_offers_in_database": total_offers_in_db,
        "brand_stats": brand_stats,
        "estimated_hours": round(estimated_hours, 1),
        "estimated_days": round(estimated_hours / 24, 1),
        "estimated_minutes": round(total_time_seconds / 60, 1),
        "config": {
            "brands_count": len(brands),
            "date_from": date_from,
            "date_to": date_to,
            "max_workers": max_workers,
            "max_offers_per_brand": max_offers_per_brand
        }
    }


@app.get("/admin/scraper/logs")
def get_scraper_logs(
    current_user: User = Depends(get_current_admin_user),
    lines: int = Query(100, ge=1, le=1000, description="Number of last lines to return")
):
    """
    Zwraca ostatnie linie z pliku logów scrapera.
    """
    if not SCRAPER_LOG_FILE.exists():
        return {"logs": "", "message": "Log file does not exist yet. Start scraping to generate logs."}
    
    try:
        with open(SCRAPER_LOG_FILE, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            # Zwróć ostatnie N linii
            last_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            return {
                "logs": "".join(last_lines),
                "total_lines": len(all_lines),
                "returned_lines": len(last_lines)
            }
    except Exception as e:
        logger.error(f"Error reading scraper logs: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading logs: {str(e)}")


# ================== ZAPISANE WYCENY I PORÓWNANIA ==================

@app.post("/saved/valuations", response_model=schemas.SavedValuationResponse)
def save_valuation(
    valuation: schemas.SaveValuationRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Zapisuje wycenę pojazdu."""
    saved = SavedValuation(
        user_id=current_user.id,
        title=valuation.title,
        brand=valuation.brand,
        model=valuation.model,
        generation=valuation.generation,
        year=valuation.year,
        mileage_km=valuation.mileage_km,
        fuel_type=valuation.fuel_type,
        transmission=valuation.transmission,
        engine_capacity_cm3=valuation.engine_capacity_cm3,
        predicted_price=valuation.predicted_price,
        model_metrics=json.dumps(valuation.model_metrics.dict())
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    
    return schemas.SavedValuationResponse(
        id=saved.id,
        title=saved.title,
        brand=saved.brand,
        model=saved.model,
        generation=saved.generation,
        year=saved.year,
        mileage_km=saved.mileage_km,
        fuel_type=saved.fuel_type,
        transmission=saved.transmission,
        engine_capacity_cm3=saved.engine_capacity_cm3,
        predicted_price=saved.predicted_price,
        model_metrics=schemas.ValuationModelMetrics(**json.loads(saved.model_metrics)),
        created_at=saved.created_at.isoformat()
    )


@app.get("/saved/valuations", response_model=List[schemas.SavedValuationResponse])
def get_saved_valuations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Zwraca listę zapisanych wycen użytkownika."""
    valuations = db.query(SavedValuation).filter(
        SavedValuation.user_id == current_user.id
    ).order_by(SavedValuation.created_at.desc()).all()
    
    return [
        schemas.SavedValuationResponse(
            id=v.id,
            title=v.title,
            brand=v.brand,
            model=v.model,
            generation=v.generation,
            year=v.year,
            mileage_km=v.mileage_km,
            fuel_type=v.fuel_type,
            transmission=v.transmission,
            engine_capacity_cm3=v.engine_capacity_cm3,
            predicted_price=v.predicted_price,
            model_metrics=schemas.ValuationModelMetrics(**json.loads(v.model_metrics)) if v.model_metrics else schemas.ValuationModelMetrics(
                r2=0, rmse=0, mae=0, n_samples=0, test_size=0, features_numeric=[], features_categorical=[], target=""
            ),
            created_at=v.created_at.isoformat()
        )
        for v in valuations
    ]


@app.delete("/saved/valuations/{valuation_id}")
def delete_saved_valuation(
    valuation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Usuwa zapisaną wycenę."""
    valuation = db.query(SavedValuation).filter(
        SavedValuation.id == valuation_id,
        SavedValuation.user_id == current_user.id
    ).first()
    
    if not valuation:
        raise HTTPException(status_code=404, detail="Valuation not found")
    
    db.delete(valuation)
    db.commit()
    return {"message": "Valuation deleted"}


@app.post("/saved/comparisons", response_model=schemas.SavedComparisonResponse)
def save_comparison(
    comparison: schemas.SaveComparisonRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Zapisuje porównanie pojazdów."""
    saved = SavedComparison(
        user_id=current_user.id,
        title=comparison.title,
        comparison_data=json.dumps(comparison.comparison_data)
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    
    return schemas.SavedComparisonResponse(
        id=saved.id,
        title=saved.title,
        comparison_data=json.loads(saved.comparison_data),
        created_at=saved.created_at.isoformat()
    )


@app.get("/saved/comparisons", response_model=List[schemas.SavedComparisonResponse])
def get_saved_comparisons(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Zwraca listę zapisanych porównań użytkownika."""
    comparisons = db.query(SavedComparison).filter(
        SavedComparison.user_id == current_user.id
    ).order_by(SavedComparison.created_at.desc()).all()
    
    return [
        schemas.SavedComparisonResponse(
            id=c.id,
            title=c.title,
            comparison_data=json.loads(c.comparison_data),
            created_at=c.created_at.isoformat()
        )
        for c in comparisons
    ]


@app.delete("/saved/comparisons/{comparison_id}")
def delete_saved_comparison(
    comparison_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Usuwa zapisane porównanie."""
    comparison = db.query(SavedComparison).filter(
        SavedComparison.id == comparison_id,
        SavedComparison.user_id == current_user.id
    ).first()
    
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison not found")
    
    db.delete(comparison)
    db.commit()
    return {"message": "Comparison deleted"}