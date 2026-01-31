from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, func, cast, Integer, text

from . import models


def parse_date(date_str: str) -> Optional[datetime]:
    """
    Parsuje datę w formacie DD.MM.YYYY do obiektu datetime.
    Zwraca None jeśli data jest nieprawidłowa.
    """
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str.strip(), "%d.%m.%Y")
    except (ValueError, AttributeError):
        return None


def get_publication_date_range(db: Session) -> Tuple[Optional[str], Optional[str]]:
    """
    Zwraca (min_date, max_date) - najstarszą i najnowszą datę publikacji w bazie.
    Daty w formacie DD.MM.YYYY.
    Musimy sparsować wszystkie daty, bo sortowanie stringów DD.MM.YYYY nie działa poprawnie.
    """
    from .models import Listing
    
    # Pobierz wszystkie unikalne daty
    stmt = select(Listing.offer_publication_date).where(
        Listing.offer_publication_date.isnot(None)
    ).distinct()
    
    dates = db.execute(stmt).scalars().all()
    
    if not dates:
        return (None, None)
    
    # Parsuj wszystkie daty i znajdź min/max
    parsed_dates = []
    for date_str in dates:
        parsed = parse_date(date_str)
        if parsed:
            parsed_dates.append((parsed, date_str))
    
    if not parsed_dates:
        return (None, None)
    
    # Znajdź min i max po sparsowanych datach
    min_date_obj, min_date_str = min(parsed_dates, key=lambda x: x[0])
    max_date_obj, max_date_str = max(parsed_dates, key=lambda x: x[0])
    
    return (min_date_str, max_date_str)


def get_brands(db: Session) -> List[str]:
    """
    Zwraca listę unikalnych marek (vehicle_brand) z tabeli listings.
    """
    stmt = (
        select(models.Listing.vehicle_brand)
        .distinct()
        .order_by(models.Listing.vehicle_brand)
    )
    return db.execute(stmt).scalars().all()


def get_models_by_brand(db: Session, brand: str) -> List[str]:
    """
    Zwraca listę unikalnych modeli dla podanej marki.
    """
    stmt = (
        select(models.Listing.vehicle_model)
        .where(models.Listing.vehicle_brand == brand)
        .distinct()
        .order_by(models.Listing.vehicle_model)
    )
    return db.execute(stmt).scalars().all()


def get_generations_by_brand_model(db: Session, brand: str, model: str) -> List[str]:
    """
    Zwraca listę unikalnych generacji dla podanej marki i modelu.
    Zwraca tylko generacje, które mają vehicle_generation != NULL.
    """
    stmt = (
        select(models.Listing.vehicle_generation)
        .where(
            models.Listing.vehicle_brand == brand,
            models.Listing.vehicle_model == model,
            models.Listing.vehicle_generation.isnot(None)
        )
        .distinct()
        .order_by(models.Listing.vehicle_generation)
    )
    return db.execute(stmt).scalars().all()


def get_fuel_types_by_brand_model(db: Session, brand: str, model: str) -> List[str]:
    """
    Zwraca listę unikalnych typów paliwa (fuel_type) dla podanej marki i modelu.
    Zwraca posortowane wartości.
    """
    stmt = (
        select(models.Listing.fuel_type)
        .where(
            models.Listing.vehicle_brand == brand,
            models.Listing.vehicle_model == model,
            models.Listing.fuel_type.isnot(None)
        )
        .distinct()
        .order_by(models.Listing.fuel_type)
    )
    return db.execute(stmt).scalars().all()


def get_displacements_by_brand_model(db: Session, brand: str, model: str) -> List[float]:
    """
    Zwraca listę unikalnych pojemności silnika (displacement_cm3) dla podanej marki i modelu.
    Zwraca posortowane wartości.
    """
    stmt = (
        select(models.Listing.displacement_cm3)
        .where(
            models.Listing.vehicle_brand == brand,
            models.Listing.vehicle_model == model,
            models.Listing.displacement_cm3.isnot(None)
        )
        .distinct()
        .order_by(models.Listing.displacement_cm3)
    )
    return [float(d) for d in db.execute(stmt).scalars().all()]


def get_fuel_types(db: Session) -> List[str]:
    """
    Zwraca listę unikalnych typów paliwa (fuel_type) z tabeli listings.
    """
    from .models import Listing

    stmt = (
        select(Listing.fuel_type)
        .where(Listing.fuel_type.isnot(None))
        .distinct()
        .order_by(Listing.fuel_type)
    )
    return db.execute(stmt).scalars().all()


def get_transmissions(db: Session) -> List[str]:
    """
    Zwraca listę unikalnych typów skrzyni biegów (transmission) z tabeli listings.
    """
    from .models import Listing

    stmt = (
        select(Listing.transmission)
        .where(Listing.transmission.isnot(None))
        .distinct()
        .order_by(Listing.transmission)
    )
    return db.execute(stmt).scalars().all()


def apply_filters(
    stmt,
    brand: Optional[str],
    model: Optional[str],
    generation: Optional[str],
    year_min: Optional[int],
    year_max: Optional[int],
    mileage_max: Optional[float],
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
):
    """
    Wspólna funkcja do nakładania filtrów na zapytanie SQLAlchemy.
    date_from i date_to w formacie DD.MM.YYYY.
    """
    if brand:
        stmt = stmt.where(models.Listing.vehicle_brand == brand)
    if model:
        stmt = stmt.where(models.Listing.vehicle_model == model)
    if generation:
        stmt = stmt.where(models.Listing.vehicle_generation == generation)
    if year_min is not None:
        stmt = stmt.where(models.Listing.production_year >= year_min)
    if year_max is not None:
        stmt = stmt.where(models.Listing.production_year <= year_max)
    if mileage_max is not None:
        stmt = stmt.where(models.Listing.mileage_km <= mileage_max)
    if displacement_min is not None:
        stmt = stmt.where(models.Listing.displacement_cm3 >= displacement_min)
    if displacement_max is not None:
        stmt = stmt.where(models.Listing.displacement_cm3 <= displacement_max)
    if fuel_type:
        stmt = stmt.where(models.Listing.fuel_type == fuel_type)
    
    # Filtrowanie po dacie publikacji (format DD.MM.YYYY)
    # Konwertujemy DD.MM.YYYY na YYYYMMDD dla porównania
    if date_from:
        date_from_parsed = parse_date(date_from)
        if date_from_parsed:
            # Konwertujemy datę do formatu YYYYMMDD dla porównania (jako integer)
            date_from_int = int(date_from_parsed.strftime("%Y%m%d"))
            # Konwertujemy kolumnę z DD.MM.YYYY do YYYYMMDD używając substr i || (SQLite)
            # Format: DD.MM.YYYY -> SUBSTR(date, 7, 4) || SUBSTR(date, 4, 2) || SUBSTR(date, 1, 2)
            # Używamy text() z operatorem || dla SQLite
            date_converted = cast(
                text(
                    "SUBSTR(offer_publication_date, 7, 4) || "
                    "SUBSTR(offer_publication_date, 4, 2) || "
                    "SUBSTR(offer_publication_date, 1, 2)"
                ),
                Integer
            )
            stmt = stmt.where(
                models.Listing.offer_publication_date.isnot(None),
                date_converted >= date_from_int
            )
    
    if date_to:
        date_to_parsed = parse_date(date_to)
        if date_to_parsed:
            date_to_int = int(date_to_parsed.strftime("%Y%m%d"))
            date_converted = cast(
                text(
                    "SUBSTR(offer_publication_date, 7, 4) || "
                    "SUBSTR(offer_publication_date, 4, 2) || "
                    "SUBSTR(offer_publication_date, 1, 2)"
                ),
                Integer
            )
            stmt = stmt.where(
                models.Listing.offer_publication_date.isnot(None),
                date_converted <= date_to_int
            )
    
    return stmt


def get_analysis(
    db: Session,
    brand: Optional[str],
    model: Optional[str],
    generation: Optional[str],
    year_min: Optional[int],
    year_max: Optional[int],
    mileage_max: Optional[float],
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
) -> Tuple[int, Optional[float], Optional[float], Optional[float]]:
    """
    Zwraca: liczba ofert, średnia cena, min, max dla zadanych filtrów.
    """
    stmt = select(
        func.count(models.Listing.id),
        func.avg(models.Listing.price_pln),
        func.min(models.Listing.price_pln),
        func.max(models.Listing.price_pln),
    )
    stmt = apply_filters(stmt, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type)
    return db.execute(stmt).one()


def get_price_statistics(
    db: Session,
    brand: Optional[str],
    model: Optional[str],
    generation: Optional[str],
    year_min: Optional[int],
    year_max: Optional[int],
    mileage_max: Optional[float],
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
) -> dict:
    """
    Zwraca szczegółowe statystyki cen: średnia, mediana, odchylenie standardowe, kwartyle (Q1, Q3).
    """
    from .models import Listing
    
    stmt = select(Listing.price_pln)
    stmt = apply_filters(stmt, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type)
    
    prices = [float(p) for p in db.execute(stmt).scalars().all()]
    
    if not prices:
        return {
            "n_offers": 0,
            "mean": None,
            "median": None,
            "std_dev": None,
            "q1": None,
            "q3": None,
            "min": None,
            "max": None,
        }
    
    import numpy as np
    
    prices_array = np.array(prices)
    sorted_prices = np.sort(prices_array)
    n = len(sorted_prices)
    
    # Średnia
    mean = float(np.mean(prices_array))
    
    # Mediana
    median = float(np.median(prices_array))
    
    # Odchylenie standardowe
    std_dev = float(np.std(prices_array, ddof=1)) if n > 1 else 0.0
    
    # Kwartyle
    q1 = float(np.percentile(sorted_prices, 25))
    q3 = float(np.percentile(sorted_prices, 75))
    
    # Min i Max
    min_price = float(np.min(prices_array))
    max_price = float(np.max(prices_array))
    
    return {
        "n_offers": n,
        "mean": mean,
        "median": median,
        "std_dev": std_dev,
        "q1": q1,
        "q3": q3,
        "min": min_price,
        "max": max_price,
    }


def get_listings_filtered(
    db: Session,
    brand: Optional[str],
    model: Optional[str],
    generation: Optional[str],
    year_min: Optional[int],
    year_max: Optional[int],
    mileage_max: Optional[float],
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    sort_by: Optional[str] = None,
    sort_dir: str = "desc",
):
    """
    Zwraca (total, items):
    - total: łączna liczba rekordów spełniających warunki,
    - items: lista obiektów Listing (z paginacją i sortowaniem po CAŁEJ bazie).
    """
    from .models import Listing  # lokalny import

    # liczymy łączną liczbę
    stmt_count = select(func.count(Listing.id))
    stmt_count = apply_filters(stmt_count, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type)
    total = db.execute(stmt_count).scalar_one()

    # bazowe zapytanie
    stmt_items = select(Listing)
    stmt_items = apply_filters(stmt_items, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type)

    # wybór kolumny sortowania
    order_column = Listing.production_year  # domyślnie rok
    if sort_by == "mileage":
        order_column = Listing.mileage_km
    elif sort_by == "price":
        order_column = Listing.price_pln
    elif sort_by == "year":
        order_column = Listing.production_year
    elif sort_by == "brand":
        order_column = Listing.vehicle_brand
    elif sort_by == "model":
        order_column = Listing.vehicle_model

    # kierunek sortowania
    if sort_dir == "asc":
        stmt_items = stmt_items.order_by(order_column.asc())
    else:
        stmt_items = stmt_items.order_by(order_column.desc())

    # paginacja
    stmt_items = stmt_items.limit(limit).offset(offset)
    items = db.execute(stmt_items).scalars().all()

    return total, items


def get_trend_by_year(
    db: Session,
    brand: Optional[str],
    model: Optional[str],
    generation: Optional[str],
    year_min: Optional[int],
    year_max: Optional[int],
    mileage_max: Optional[float],
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
):
    """
    Zwraca listę punktów: rok, liczba ofert, średnia cena, mediana ceny.
    """
    from .models import Listing  # lokalny import, żeby uniknąć pętli

    stmt = select(
        Listing.production_year.label("year"),
        func.count(Listing.id).label("n_offers"),
        func.avg(Listing.price_pln).label("avg_price"),
    )

    stmt = apply_filters(stmt, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type)
    stmt = stmt.group_by(Listing.production_year).order_by(Listing.production_year)

    rows = db.execute(stmt).all()

    # Obliczanie mediany dla każdego roku
    def get_median_for_year(year: int) -> Optional[float]:
        stmt_median = select(Listing.price_pln)
        stmt_median = apply_filters(stmt_median, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type)
        stmt_median = stmt_median.where(
            Listing.production_year == year,
            Listing.price_pln.isnot(None)
        )
        prices = [float(p) for p in db.execute(stmt_median).scalars().all()]
        if not prices:
            return None
        prices.sort()
        n = len(prices)
        if n % 2 == 0:
            return (prices[n // 2 - 1] + prices[n // 2]) / 2
        else:
            return prices[n // 2]

    result = []
    for row in rows:
        if row.year is not None and row.avg_price is not None:
            median = get_median_for_year(int(row.year))
            result.append({
                "year": int(row.year),
                "n_offers": int(row.n_offers),
                "avg_price": float(row.avg_price),
                "median_price": median,
            })
    
    return result


def get_price_mileage_data(
    db: Session,
    brand: Optional[str],
    model: Optional[str],
    generation: Optional[str],
    year_min: Optional[int],
    year_max: Optional[int],
    mileage_max: Optional[float],
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
    limit: int = 5000,
):
    """
    Zwraca listę punktów (cena, przebieg) dla wykresu scatter.
    """
    from .models import Listing

    stmt = select(
        Listing.price_pln,
        Listing.mileage_km,
    )
    stmt = apply_filters(stmt, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type)
    stmt = stmt.where(
        Listing.price_pln.isnot(None),
        Listing.mileage_km.isnot(None),
    )
    stmt = stmt.limit(limit)

    rows = db.execute(stmt).all()

    return [
        {
            "price_pln": float(row.price_pln),
            "mileage_km": float(row.mileage_km),
        }
        for row in rows
        if row.price_pln is not None and row.mileage_km is not None
    ]


def get_price_stats_by_category(
    db: Session,
    brand: Optional[str],
    model: Optional[str],
    generation: Optional[str],
    year_min: Optional[int],
    year_max: Optional[int],
    mileage_max: Optional[float],
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    displacement_min: Optional[float] = None,
    displacement_max: Optional[float] = None,
    fuel_type: Optional[str] = None,
):
    """
    Zwraca statystyki cen wg paliwa i skrzyni biegów.
    """
    from .models import Listing

    # Statystyki wg paliwa
    stmt_fuel = select(
        Listing.fuel_type.label("category"),
        func.avg(Listing.price_pln).label("avg_price"),
        func.count(Listing.id).label("n_offers"),
    )
    stmt_fuel = apply_filters(stmt_fuel, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type)
    stmt_fuel = stmt_fuel.where(
        Listing.fuel_type.isnot(None),
        Listing.price_pln.isnot(None),
    )
    stmt_fuel = stmt_fuel.group_by(Listing.fuel_type).order_by(Listing.fuel_type)

    rows_fuel = db.execute(stmt_fuel).all()

    # Statystyki wg skrzyni biegów
    stmt_trans = select(
        Listing.transmission.label("category"),
        func.avg(Listing.price_pln).label("avg_price"),
        func.count(Listing.id).label("n_offers"),
    )
    stmt_trans = apply_filters(stmt_trans, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type)
    stmt_trans = stmt_trans.where(
        Listing.transmission.isnot(None),
        Listing.price_pln.isnot(None),
    )
    stmt_trans = stmt_trans.group_by(Listing.transmission).order_by(Listing.transmission)

    rows_trans = db.execute(stmt_trans).all()

    # Obliczanie mediany dla każdej kategorii (wymaga osobnych zapytań)
    def get_median_for_category(category: str, is_fuel: bool = True):
        stmt_median = select(Listing.price_pln)
        stmt_median = apply_filters(stmt_median, brand, model, generation, year_min, year_max, mileage_max, date_from, date_to, displacement_min, displacement_max, fuel_type)
        stmt_median = stmt_median.where(Listing.price_pln.isnot(None))
        if is_fuel:
            stmt_median = stmt_median.where(Listing.fuel_type == category)
        else:
            stmt_median = stmt_median.where(Listing.transmission == category)
        prices = [float(p) for p in db.execute(stmt_median).scalars().all()]
        if not prices:
            return None
        prices.sort()
        n = len(prices)
        if n % 2 == 0:
            return (prices[n // 2 - 1] + prices[n // 2]) / 2
        else:
            return prices[n // 2]

    by_fuel = []
    for row in rows_fuel:
        if row.category and row.avg_price is not None:
            median = get_median_for_category(row.category, is_fuel=True)
            by_fuel.append({
                "category": str(row.category),
                "avg_price": float(row.avg_price),
                "median_price": median,
                "n_offers": int(row.n_offers),
            })

    by_transmission = []
    for row in rows_trans:
        if row.category and row.avg_price is not None:
            median = get_median_for_category(row.category, is_fuel=False)
            by_transmission.append({
                "category": str(row.category),
                "avg_price": float(row.avg_price),
                "median_price": median,
                "n_offers": int(row.n_offers),
            })

    return by_fuel, by_transmission


def get_vehicle_comparison(
    db: Session,
    vehicle_a_filters: dict,
    vehicle_b_filters: dict,
) -> dict:
    """
    Porównuje dwa pojazdy na podstawie filtrów.
    Zwraca metryki, trend cenowy i dane cena vs przebieg dla obu pojazdów.
    """
    from .models import Listing
    from sqlalchemy import func
    
    def get_metrics(filters: dict) -> dict:
        """Pobiera metryki dla pojazdu z danymi filtrami."""
        stmt = select(Listing)
        stmt = apply_filters(
            stmt,
            brand=filters.get("brand"),
            model=filters.get("model"),
            generation=filters.get("generation"),
            year_min=filters.get("year_min"),
            year_max=filters.get("year_max"),
            mileage_max=filters.get("mileage_max"),
            date_from=filters.get("date_from"),
            date_to=filters.get("date_to"),
            displacement_min=filters.get("displacement_min"),
            displacement_max=filters.get("displacement_max"),
            fuel_type=filters.get("fuel_type"),
        )
        
        # Dodatkowe filtry
        if filters.get("transmission"):
            stmt = stmt.where(Listing.transmission == filters["transmission"])
        
        # Oblicz metryki
        metrics_stmt = select(
            func.count(Listing.id).label("n_offers"),
            func.avg(Listing.price_pln).label("avg_price"),
            func.avg(Listing.mileage_km).label("avg_mileage"),
            func.avg(Listing.power_hp).label("avg_power"),
            func.avg(Listing.displacement_cm3).label("avg_displacement"),
            func.min(Listing.price_pln).label("min_price"),
            func.max(Listing.price_pln).label("max_price"),
        )
        metrics_stmt = apply_filters(
            metrics_stmt,
            brand=filters.get("brand"),
            model=filters.get("model"),
            generation=filters.get("generation"),
            year_min=filters.get("year_min"),
            year_max=filters.get("year_max"),
            mileage_max=filters.get("mileage_max"),
            date_from=filters.get("date_from"),
            date_to=filters.get("date_to"),
            displacement_min=filters.get("displacement_min"),
            displacement_max=filters.get("displacement_max"),
            fuel_type=filters.get("fuel_type"),
        )
        
        if filters.get("transmission"):
            metrics_stmt = metrics_stmt.where(Listing.transmission == filters["transmission"])
        
        result = db.execute(metrics_stmt).one()
        
        # Mediana ceny - pobierz wszystkie ceny i oblicz medianę w Pythonie
        prices_stmt = select(Listing.price_pln)
        prices_stmt = apply_filters(
            prices_stmt,
            brand=filters.get("brand"),
            model=filters.get("model"),
            generation=filters.get("generation"),
            year_min=filters.get("year_min"),
            year_max=filters.get("year_max"),
            mileage_max=filters.get("mileage_max"),
            date_from=filters.get("date_from"),
            date_to=filters.get("date_to"),
            displacement_min=filters.get("displacement_min"),
            displacement_max=filters.get("displacement_max"),
            fuel_type=filters.get("fuel_type"),
        )
        if filters.get("transmission"):
            prices_stmt = prices_stmt.where(Listing.transmission == filters["transmission"])
        
        prices = [float(p) for p in db.execute(prices_stmt).scalars().all()]
        median_price = None
        if prices:
            sorted_prices = sorted(prices)
            n = len(sorted_prices)
            if n % 2 == 0:
                median_price = (sorted_prices[n // 2 - 1] + sorted_prices[n // 2]) / 2
            else:
                median_price = sorted_prices[n // 2]
        
        return {
            "n_offers": result.n_offers or 0,
            "avg_price": float(result.avg_price) if result.avg_price else None,
            "median_price": median_price,
            "min_price": float(result.min_price) if result.min_price else None,
            "max_price": float(result.max_price) if result.max_price else None,
            "avg_mileage": float(result.avg_mileage) if result.avg_mileage else None,
            "avg_power_hp": float(result.avg_power) if result.avg_power else None,
            "avg_displacement_cm3": float(result.avg_displacement) if result.avg_displacement else None,
        }
    
    def get_trend(filters: dict) -> List[dict]:
        """Pobiera trend cenowy wg roku dla pojazdu."""
        stmt = select(
            Listing.production_year.label("year"),
            func.avg(Listing.price_pln).label("avg_price"),
            func.count(Listing.id).label("n_offers"),
        )
        stmt = apply_filters(
            stmt,
            brand=filters.get("brand"),
            model=filters.get("model"),
            generation=filters.get("generation"),
            year_min=filters.get("year_min"),
            year_max=filters.get("year_max"),
            mileage_max=filters.get("mileage_max"),
            date_from=filters.get("date_from"),
            date_to=filters.get("date_to"),
            displacement_min=filters.get("displacement_min"),
            displacement_max=filters.get("displacement_max"),
            fuel_type=filters.get("fuel_type"),
        )
        
        if filters.get("transmission"):
            stmt = stmt.where(Listing.transmission == filters["transmission"])
        
        stmt = stmt.group_by(Listing.production_year).order_by(Listing.production_year)
        
        results = db.execute(stmt).all()
        return [
            {
                "year": row.year,
                "avg_price": float(row.avg_price) if row.avg_price else None,
                "n_offers": row.n_offers,
            }
            for row in results
        ]
    
    def get_price_mileage(filters: dict) -> List[dict]:
        """Pobiera dane cena vs przebieg dla pojazdu."""
        stmt = select(
            Listing.price_pln,
            Listing.mileage_km,
        )
        stmt = apply_filters(
            stmt,
            brand=filters.get("brand"),
            model=filters.get("model"),
            generation=filters.get("generation"),
            year_min=filters.get("year_min"),
            year_max=filters.get("year_max"),
            mileage_max=filters.get("mileage_max"),
            date_from=filters.get("date_from"),
            date_to=filters.get("date_to"),
            displacement_min=filters.get("displacement_min"),
            displacement_max=filters.get("displacement_max"),
            fuel_type=filters.get("fuel_type"),
        )
        
        if filters.get("transmission"):
            stmt = stmt.where(Listing.transmission == filters["transmission"])
        
        stmt = stmt.where(
            Listing.mileage_km.isnot(None),
            Listing.price_pln.isnot(None),
        )
        
        results = db.execute(stmt).all()
        return [
            {
                "price_pln": float(row.price_pln),
                "mileage_km": float(row.mileage_km),
            }
            for row in results
        ]
    
    # Pobierz metryki dla obu pojazdów
    metrics_a = get_metrics(vehicle_a_filters)
    metrics_b = get_metrics(vehicle_b_filters)
    
    # Pobierz trend dla obu pojazdów
    trend_a = get_trend(vehicle_a_filters)
    trend_b = get_trend(vehicle_b_filters)
    
    # Połącz trendy w jeden format
    years_set = set()
    trend_dict_a = {t["year"]: t for t in trend_a}
    trend_dict_b = {t["year"]: t for t in trend_b}
    years_set.update(trend_dict_a.keys())
    years_set.update(trend_dict_b.keys())
    
    trend_combined = []
    for year in sorted(years_set):
        trend_combined.append({
            "year": year,
            "avg_price_a": trend_dict_a.get(year, {}).get("avg_price"),
            "avg_price_b": trend_dict_b.get(year, {}).get("avg_price"),
            "n_offers_a": trend_dict_a.get(year, {}).get("n_offers", 0),
            "n_offers_b": trend_dict_b.get(year, {}).get("n_offers", 0),
        })
    
    # Pobierz dane cena vs przebieg
    price_mileage_a = get_price_mileage(vehicle_a_filters)
    price_mileage_b = get_price_mileage(vehicle_b_filters)
    
    # Utwórz etykiety dla pojazdów
    label_a = f"{vehicle_a_filters.get('brand', '')} {vehicle_a_filters.get('model', '')}"
    if vehicle_a_filters.get("generation"):
        label_a += f" ({vehicle_a_filters['generation']})"
    if vehicle_a_filters.get("version"):
        label_a += f" {vehicle_a_filters['version']}"
    
    label_b = f"{vehicle_b_filters.get('brand', '')} {vehicle_b_filters.get('model', '')}"
    if vehicle_b_filters.get("generation"):
        label_b += f" ({vehicle_b_filters['generation']})"
    if vehicle_b_filters.get("version"):
        label_b += f" {vehicle_b_filters['version']}"
    
    return {
        "vehicle_a_label": label_a,
        "vehicle_b_label": label_b,
        "metrics_a": metrics_a,
        "metrics_b": metrics_b,
        "trend_by_year": trend_combined,
        "price_mileage_a": price_mileage_a,
        "price_mileage_b": price_mileage_b,
    }