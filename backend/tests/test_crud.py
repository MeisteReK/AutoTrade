"""
Testy funkcji CRUD.
"""
import pytest
from app import crud
from app.models import Listing


def test_get_brands(db, sample_listings):
    """Test pobierania listy marek."""
    brands = crud.get_brands(db)
    assert len(brands) >= 2
    assert "Toyota" in brands
    assert "BMW" in brands


def test_get_models_by_brand(db, sample_listings):
    """Test pobierania modeli dla marki."""
    models = crud.get_models_by_brand(db, "Toyota")
    assert "Corolla" in models
    assert len(models) >= 1


def test_get_analysis(db, sample_listings):
    """Test funkcji get_analysis."""
    n_offers, avg_price, min_price, max_price = crud.get_analysis(
        db, brand="Toyota", model=None, generation=None,
        year_min=None, year_max=None, mileage_max=None,
        date_from=None, date_to=None, displacement_min=None,
        displacement_max=None, fuel_type=None
    )
    assert n_offers == 2  # 2 oferty Toyoty
    assert avg_price is not None
    assert min_price is not None
    assert max_price is not None
    assert min_price <= avg_price <= max_price


def test_get_listings_filtered(db, sample_listings):
    """Test filtrowania ofert."""
    total, items = crud.get_listings_filtered(
        db, brand="Toyota", model=None, generation=None,
        year_min=None, year_max=None, mileage_max=None,
        date_from=None, date_to=None, displacement_min=None,
        displacement_max=None, fuel_type=None,
        limit=10, offset=0, sort_by="year", sort_dir="desc"
    )
    assert total == 2
    assert len(items) == 2
    # Sprawdź sortowanie (najnowszy rok pierwszy)
    assert items[0].production_year >= items[1].production_year


def test_get_listings_filtered_with_filters(db, sample_listings):
    """Test filtrowania ofert z dodatkowymi filtrami."""
    total, items = crud.get_listings_filtered(
        db, brand="Toyota", model="Corolla", generation=None,
        year_min=2020, year_max=2022, mileage_max=40000,
        date_from=None, date_to=None, displacement_min=None,
        displacement_max=None, fuel_type=None,
        limit=10, offset=0, sort_by=None, sort_dir="asc"
    )
    assert total >= 1
    for item in items:
        assert item.vehicle_brand == "Toyota"
        assert item.vehicle_model == "Corolla"
        assert 2020 <= item.production_year <= 2022
        assert item.mileage_km <= 40000


def test_parse_date():
    """Test parsowania daty."""
    from app.crud import parse_date
    
    # Poprawna data
    date = parse_date("15.03.2024")
    assert date is not None
    assert date.day == 15
    assert date.month == 3
    assert date.year == 2024
    
    # Niepoprawna data
    assert parse_date("invalid") is None
    assert parse_date("") is None
    assert parse_date(None) is None

