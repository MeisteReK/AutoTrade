from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .db import Base


class Listing(Base):
    __tablename__ = "listings"

    # z CSV: Index
    id = Column(Integer, primary_key=True, index=True)

    # cena i waluta
    price_pln = Column(Float, index=True, nullable=False)       # Price (z indeksem dla szybkich zapytań)
    currency = Column(String(3), nullable=False)    # Currency (PLN)

    # stan
    condition = Column(String, nullable=True)       # Condition (New/Used)

    # opis samochodu
    vehicle_brand = Column(String, index=True, nullable=False)
    vehicle_model = Column(String, index=True, nullable=False)
    vehicle_version = Column(String, nullable=True)
    vehicle_generation = Column(String, nullable=True)

    production_year = Column(Integer, index=True, nullable=False)
    mileage_km = Column(Float, index=True, nullable=True)
    power_hp = Column(Float, nullable=True)
    displacement_cm3 = Column(Float, nullable=True)

    fuel_type = Column(String, index=True, nullable=True)
    co2_emissions = Column(Float, nullable=True)

    drive = Column(String, nullable=True)           # Front wheels etc.
    transmission = Column(String, index=True, nullable=True)
    type = Column(String, nullable=True)            # small_cars, coupe...

    doors_number = Column(Float, nullable=True)
    colour = Column(String, nullable=True)
    origin_country = Column(String, nullable=True)

    first_owner = Column(Boolean, nullable=True)    # Yes / No / None
    first_registration_date = Column(String, nullable=True)
    offer_publication_date = Column(String, nullable=True)

    offer_location = Column(String, nullable=True)

    # lista wyposażenia jako tekst
    features = Column(String, nullable=True)


# ================== MODELE AUTENTYKACJI I ZAPISANYCH ELEMENTÓW ==================

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")  # "user" lub "admin"
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relacje
    saved_valuations = relationship("SavedValuation", back_populates="user", cascade="all, delete-orphan")
    saved_comparisons = relationship("SavedComparison", back_populates="user", cascade="all, delete-orphan")


class SavedValuation(Base):
    __tablename__ = "saved_valuations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)  # np. "Audi A4 2020"
    brand = Column(String, nullable=False)
    model = Column(String, nullable=False)
    generation = Column(String, nullable=True)
    year = Column(Integer, nullable=False)
    mileage_km = Column(Float, nullable=False)
    fuel_type = Column(String, nullable=False)
    transmission = Column(String, nullable=False)
    engine_capacity_cm3 = Column(Float, nullable=False)
    predicted_price = Column(Float, nullable=False)
    model_metrics = Column(Text, nullable=True)  # JSON jako string
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="saved_valuations")


class SavedComparison(Base):
    __tablename__ = "saved_comparisons"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)  # np. "Audi A4 vs BMW 3"
    comparison_data = Column(Text, nullable=False)  # JSON jako string
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="saved_comparisons")
