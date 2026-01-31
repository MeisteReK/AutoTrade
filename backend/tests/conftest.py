"""
Konfiguracja pytest - wspólne fixtures dla wszystkich testów.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
import os
import tempfile
import shutil

from app.db import Base, get_db
from app.main import app
from app.models import User, Listing


# Testowa baza danych - używamy pliku tymczasowego dla większej stabilności
TEST_DATABASE_URL = "sqlite:///./test_autotrade.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Tworzy nową bazę danych dla każdego testu."""
    # Usuń wszystkie tabele przed utworzeniem nowych (dla czystego stanu)
    Base.metadata.drop_all(bind=engine)
    # Utwórz wszystkie tabele
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
        # Usuń tabele po teście
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Tworzy testowego klienta FastAPI z testową bazą danych."""
    # Upewnij się, że tabele są utworzone
    Base.metadata.create_all(bind=engine)
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db):
    """Tworzy testowego użytkownika."""
    from app.auth import get_password_hash
    
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("testpass123"),
        role="user",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_admin(db):
    """Tworzy testowego administratora."""
    from app.auth import get_password_hash
    
    admin = User(
        username="admin",
        email="admin@example.com",
        hashed_password=get_password_hash("admin123"),
        role="admin",
        is_active=True
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture
def auth_headers(test_user):
    """Zwraca nagłówki z tokenem JWT dla testowego użytkownika."""
    from app.auth import create_access_token
    
    token = create_access_token(data={"sub": test_user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(test_admin):
    """Zwraca nagłówki z tokenem JWT dla administratora."""
    from app.auth import create_access_token
    
    token = create_access_token(data={"sub": test_admin.username})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_listings(db):
    """Tworzy przykładowe oferty w bazie."""
    listings = [
        Listing(
            vehicle_brand="Toyota",
            vehicle_model="Corolla",
            production_year=2020,
            mileage_km=50000,
            price_pln=80000,
            currency="PLN",
            fuel_type="Benzyna",
            transmission="Manualna",
            displacement_cm3=1800,
            offer_publication_date="01.01.2024"
        ),
        Listing(
            vehicle_brand="BMW",
            vehicle_model="Series 3",
            production_year=2019,
            mileage_km=60000,
            price_pln=120000,
            currency="PLN",
            fuel_type="Diesel",
            transmission="Automatyczna",
            displacement_cm3=2000,
            offer_publication_date="15.02.2024"
        ),
        Listing(
            vehicle_brand="Toyota",
            vehicle_model="Corolla",
            production_year=2021,
            mileage_km=30000,
            price_pln=90000,
            currency="PLN",
            fuel_type="Benzyna",
            transmission="Manualna",
            displacement_cm3=1800,
            offer_publication_date="20.03.2024"
        ),
    ]
    for listing in listings:
        db.add(listing)
    db.commit()
    return listings

