from typing import Optional, List, Dict
from pydantic import BaseModel, Field, field_validator, ConfigDict
from datetime import datetime


class ListingBase(BaseModel):
    price_pln: float
    currency: str
    condition: Optional[str] = None

    vehicle_brand: str
    vehicle_model: str
    vehicle_version: Optional[str] = None
    vehicle_generation: Optional[str] = None

    production_year: int
    mileage_km: Optional[float] = None
    power_hp: Optional[float] = None
    displacement_cm3: Optional[float] = None

    fuel_type: Optional[str] = None
    co2_emissions: Optional[float] = None

    drive: Optional[str] = None
    transmission: Optional[str] = None
    type: Optional[str] = None

    doors_number: Optional[float] = None
    colour: Optional[str] = None
    origin_country: Optional[str] = None

    first_owner: Optional[bool] = None
    first_registration_date: Optional[str] = None
    offer_publication_date: Optional[str] = None

    offer_location: Optional[str] = None
    features: Optional[str] = None


class Listing(ListingBase):
    id: int

    class Config:
        from_attributes = True  # pozwala tworzyć z obiektów ORM


class AnalysisResult(BaseModel):
    filters: Dict[str, object]
    n_offers: int
    avg_price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None


class PriceStatisticsResponse(BaseModel):
    filters: Dict[str, object]
    n_offers: int
    mean: Optional[float] = None
    median: Optional[float] = None
    std_dev: Optional[float] = None
    q1: Optional[float] = None
    q3: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None


class ListingsResponse(BaseModel):
    filters: dict
    limit: int
    offset: int
    total: int
    items: List[Listing]


class TrendPoint(BaseModel):
    year: int
    n_offers: int
    avg_price: float
    median_price: Optional[float] = None


class TrendResponse(BaseModel):
    filters: Dict[str, object]
    points: List[TrendPoint]

    # === Wycena pojazdu (regresja) ===

class ValuationTrainingFilters(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    generation: Optional[str] = None
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    mileage_max: Optional[float] = None
    displacement_min: Optional[float] = None
    displacement_max: Optional[float] = None
    fuel_type: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


class ValuationModelConfig(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    model_type: str = "linear"
    features_numeric: Optional[List[str]] = None
    features_categorical: Optional[List[str]] = None
    alpha: Optional[float] = None
    n_estimators: Optional[int] = None
    max_depth: Optional[int] = None
    min_samples_split: Optional[int] = None
    min_samples_leaf: Optional[int] = None
    test_size: Optional[float] = None
    random_state: Optional[int] = None


class ValuationRequest(BaseModel):
    brand: str = Field(..., min_length=1, max_length=100)
    model: str = Field(..., min_length=1, max_length=100)
    generation: Optional[str] = Field(None, max_length=100)
    year: int = Field(..., ge=1900, le=2025, description="Rok produkcji (1900-2025)")
    mileage_km: float = Field(..., ge=0, le=1000000, description="Przebieg w km (0-1000000)")
    fuel_type: str = Field(..., min_length=1, max_length=50)
    transmission: str = Field(..., min_length=1, max_length=50)
    engine_capacity_cm3: float = Field(..., ge=500, le=8000, description="Pojemność silnika w cm³ (500-8000)")
    training_filters: Optional[ValuationTrainingFilters] = None
    valuation_model_config: Optional[ValuationModelConfig] = None
    
    @field_validator('brand', 'model', 'fuel_type', 'transmission')
    @classmethod
    def validate_string_fields(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Pole nie może być puste')
        return v.strip()


class ValuationModelMetrics(BaseModel):
    r2: float
    rmse: float
    mae: float
    n_samples: int
    test_size: float
    features_numeric: List[str]
    features_categorical: List[str]
    target: str


class ValuationResponse(BaseModel):
    # wyłączamy protected_namespaces z "model_"
    model_config = ConfigDict(protected_namespaces=())

    predicted_price: float
    model_metrics: ValuationModelMetrics


# === Analizy zaawansowane ===

class PriceMileagePoint(BaseModel):
    price_pln: float
    mileage_km: float


class PriceMileageResponse(BaseModel):
    filters: Dict[str, object]
    points: List[PriceMileagePoint]


class PriceStatsByCategory(BaseModel):
    category: str
    avg_price: float
    median_price: Optional[float] = None
    n_offers: int


class PriceStatsByCategoryResponse(BaseModel):
    filters: Dict[str, object]
    by_fuel_type: List[PriceStatsByCategory]
    by_transmission: List[PriceStatsByCategory]


# === Porównania pojazdów ===

class VehicleFilter(BaseModel):
    brand: str = Field(..., min_length=1, max_length=100)
    model: str = Field(..., min_length=1, max_length=100)
    generation: Optional[str] = Field(None, max_length=100)
    displacement_min: Optional[float] = Field(None, ge=0, le=10000)
    displacement_max: Optional[float] = Field(None, ge=0, le=10000)
    year_min: Optional[int] = Field(None, ge=1900, le=2025)
    year_max: Optional[int] = Field(None, ge=1900, le=2025)
    fuel_type: Optional[str] = Field(None, max_length=50)
    transmission: Optional[str] = Field(None, max_length=50)
    mileage_max: Optional[float] = Field(None, ge=0, le=1000000)
    date_from: Optional[str] = Field(None, pattern=r'^\d{2}\.\d{2}\.\d{4}$', description="Data w formacie DD.MM.YYYY")
    date_to: Optional[str] = Field(None, pattern=r'^\d{2}\.\d{2}\.\d{4}$', description="Data w formacie DD.MM.YYYY")
    
    @field_validator('year_max')
    @classmethod
    def validate_year_range(cls, v: Optional[int], info) -> Optional[int]:
        if v is not None and 'year_min' in info.data and info.data['year_min'] is not None:
            if v < info.data['year_min']:
                raise ValueError('year_max musi być większe lub równe year_min')
        return v
    
    @field_validator('brand', 'model')
    @classmethod
    def validate_string_fields(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Pole nie może być puste')
        return v.strip()


class VehicleComparisonMetrics(BaseModel):
    avg_price: Optional[float] = None
    median_price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    avg_mileage: Optional[float] = None
    avg_power_hp: Optional[float] = None
    avg_displacement_cm3: Optional[float] = None
    n_offers: int


class ComparisonTrendPoint(BaseModel):
    year: int
    avg_price_a: Optional[float] = None
    avg_price_b: Optional[float] = None
    n_offers_a: int
    n_offers_b: int


class CompareVehiclesRequest(BaseModel):
    vehicle_a: VehicleFilter
    vehicle_b: VehicleFilter


class VehicleComparisonResponse(BaseModel):
    vehicle_a_label: str
    vehicle_b_label: str
    metrics_a: VehicleComparisonMetrics
    metrics_b: VehicleComparisonMetrics
    trend_by_year: List[ComparisonTrendPoint]
    price_mileage_a: List[PriceMileagePoint]
    price_mileage_b: List[PriceMileagePoint]


# === Admin - Status aktualizacji bazy ===

class UpdateStatusResponse(BaseModel):
    status: str  # idle, running, completed, failed, cancelled
    current_step: Optional[str] = None
    progress_percent: int
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    steps_completed: List[str] = []
    steps_failed: List[str] = []
    is_running: bool
    can_start_new: bool
    duration_seconds: Optional[int] = None
    duration_hours: Optional[float] = None


class StartUpdateRequest(BaseModel):
    start_step: Optional[str] = Field(
        default="scraping",
        description="Etap od którego zacząć: scraping, processing, database_update"
    )
    steps_to_run: Optional[List[str]] = Field(
        default=None,
        description="Lista etapów do wykonania (None = wszystkie od start_step). Możliwe wartości: scraping, processing, database_update. Uwaga: kopiowanie pliku CSV jest teraz częścią etapu 'processing'."
    )
    
    @field_validator('start_step')
    @classmethod
    def validate_start_step(cls, v: Optional[str]) -> Optional[str]:
        valid_steps = ["scraping", "processing", "database_update"]
        if v and v not in valid_steps:
            raise ValueError(f'start_step musi być jednym z: {", ".join(valid_steps)}')
        return v


# === Autentykacja ===

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., pattern=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    password: str = Field(..., min_length=8, max_length=100)
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Waliduje siłę hasła."""
        import re
        
        if len(v) < 8:
            raise ValueError("Hasło musi mieć co najmniej 8 znaków")
        
        if not re.search(r'[A-Z]', v):
            raise ValueError("Hasło musi zawierać co najmniej jedną wielką literę")
        
        if not re.search(r'[a-z]', v):
            raise ValueError("Hasło musi zawierać co najmniej jedną małą literę")
        
        if not re.search(r'\d', v):
            raise ValueError("Hasło musi zawierać co najmniej jedną cyfrę")
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError("Hasło musi zawierać co najmniej jeden znak specjalny (!@#$%^&*(),.?\":{}|<>)")
        
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# === Zapisane wyceny i porównania ===

class SaveValuationRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    title: str = Field(..., min_length=1, max_length=200)
    brand: str
    model: str
    generation: Optional[str] = None
    year: int
    mileage_km: float
    fuel_type: str
    transmission: str
    engine_capacity_cm3: float
    predicted_price: float
    model_metrics: ValuationModelMetrics


class SavedValuationResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    id: int
    title: str
    brand: str
    model: str
    generation: Optional[str] = None
    year: int
    mileage_km: float
    fuel_type: str
    transmission: str
    engine_capacity_cm3: float
    predicted_price: float
    model_metrics: ValuationModelMetrics
    created_at: str


class SaveComparisonRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    comparison_data: Dict  # Dane z VehicleComparisonResponse


class SavedComparisonResponse(BaseModel):
    id: int
    title: str
    comparison_data: Dict
    created_at: str


# === Admin - Konfiguracja scrapera ===

class ScraperConfig(BaseModel):
    max_workers: int = Field(default=2, ge=1, le=10, description="Liczba równoległych wątków")
    request_timeout: int = Field(default=15, ge=5, le=60, description="Timeout żądań HTTP (sekundy)")
    delay_between_offers_min: float = Field(default=0.8, ge=0.1, le=5.0, description="Minimalne opóźnienie między ofertami (sekundy) - bezpieczne ustawienie domyślne")
    delay_between_offers_max: float = Field(default=1.5, ge=0.1, le=5.0, description="Maksymalne opóźnienie między ofertami (sekundy) - bezpieczne ustawienie domyślne")
    delay_between_pages_min: float = Field(default=1.5, ge=0.5, le=10.0, description="Minimalne opóźnienie między stronami (sekundy) - bezpieczne ustawienie domyślne")
    delay_between_pages_max: float = Field(default=3.0, ge=0.5, le=10.0, description="Maksymalne opóźnienie między stronami (sekundy) - bezpieczne ustawienie domyślne")
    max_offers_per_brand: Optional[int] = Field(default=None, ge=1, description="Limit ofert na markę (None = bez limitu)")
    brands_to_scrape: List[str] = Field(default_factory=lambda: [
        "abarth", "alfa-romeo", "audi", "bmw", "chevrolet", "citroen",
        "dacia", "fiat", "ford", "honda", "hyundai", "kia", "mazda",
        "mercedes-benz", "nissan", "opel", "peugeot", "renault", "seat",
        "skoda", "toyota", "volkswagen", "volvo"
    ], description="Lista marek do scrapowania")
    date_from: Optional[str] = Field(
        default=None,
        pattern=r'^\d{2}\.\d{2}\.\d{4}$',
        description="Data od (format DD.MM.YYYY). Tylko oferty dodane od tej daty."
    )
    date_to: Optional[str] = Field(
        default=None,
        pattern=r'^\d{2}\.\d{2}\.\d{4}$',
        description="Data do (format DD.MM.YYYY). Tylko oferty dodane do tej daty."
    )
    
    @field_validator('date_to')
    @classmethod
    def validate_date_range(cls, v: Optional[str], info) -> Optional[str]:
        if v is not None and 'date_from' in info.data and info.data['date_from'] is not None:
            try:
                from_date = datetime.strptime(info.data['date_from'], "%d.%m.%Y")
                to_date = datetime.strptime(v, "%d.%m.%Y")
                if to_date < from_date:
                    raise ValueError('date_to musi być większe lub równe date_from')
            except ValueError as e:
                if 'date_to musi być większe' in str(e):
                    raise
                # Jeśli błąd parsowania, nie waliduj zakresu (będzie błąd w parsowaniu)
        return v
    
    @field_validator('delay_between_offers_max')
    @classmethod
    def validate_offers_delay(cls, v: float, info) -> float:
        if 'delay_between_offers_min' in info.data and info.data['delay_between_offers_min'] is not None:
            if v < info.data['delay_between_offers_min']:
                raise ValueError('delay_between_offers_max musi być większe lub równe delay_between_offers_min')
        return v
    
    @field_validator('delay_between_pages_max')
    @classmethod
    def validate_pages_delay(cls, v: float, info) -> float:
        if 'delay_between_pages_min' in info.data and info.data['delay_between_pages_min'] is not None:
            if v < info.data['delay_between_pages_min']:
                raise ValueError('delay_between_pages_max musi być większe lub równe delay_between_pages_min')
        return v