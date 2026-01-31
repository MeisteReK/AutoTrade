import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db import Base, engine, SessionLocal
from app.models import Listing


CSV_PATH = "data/car_sale_ads.csv"  # ścieżka do Twojego pliku


def bool_from_yes_no(value):
    if isinstance(value, str) and value.strip().lower() == "yes":
        return True
    if isinstance(value, str) and value.strip().lower() == "no":
        return False
    return None


def main():
    print("Sprawdzam strukturę bazy...")
    # Tworzy tabele tylko jeśli nie istnieją (nie usuwa istniejących danych)
    Base.metadata.create_all(bind=engine)

    print("Wczytuję CSV...")
    # low_memory=False -> znika DtypeWarning
    df = pd.read_csv(CSV_PATH, low_memory=False)

    # 🔹 wyrzucamy rekordy bez ceny, bo price_pln w bazie jest NOT NULL
    before = len(df)
    df = df[~pd.isna(df["Price"])].copy()
    after = len(df)
    print(f"Rekordy w CSV: {before}, po odrzuceniu bez ceny: {after}")

    db: Session = SessionLocal()
    
    # Statystyki
    inserted = 0
    updated = 0
    skipped = 0
    errors = 0
    seen_ids = set()  # do wykrywania duplikatów w samym CSV

    # Pobierz wszystkie istniejące ID z bazy dla szybszego sprawdzania
    print("Sprawdzam istniejące rekordy w bazie...")
    existing_ids = {row[0] for row in db.query(Listing.id).all()}
    print(f"Znaleziono {len(existing_ids)} istniejących rekordów w bazie.")

    print("Importuję/aktualizuję rekordy...")
    for idx, row in df.iterrows():
        try:
            offer_id = int(row["ID"])
            
            # Sprawdź czy to duplikat w samym CSV
            if offer_id in seen_ids:
                print(f"  Ostrzeżenie: Duplikat ID {offer_id} w CSV (linia {idx + 2}), pomijam...")
                skipped += 1
                continue
            seen_ids.add(offer_id)
            
            listing = Listing(
                id=offer_id,
                price_pln=float(row["Price"]),  # teraz mamy gwarancję, że nie jest NaN
                currency=str(row["Currency"]),
                condition=str(row["Condition"]) if not pd.isna(row["Condition"]) else None,
                vehicle_brand=str(row["Vehicle_brand"]),
                vehicle_model=str(row["Vehicle_model"]),
                vehicle_version=None if pd.isna(row["Vehicle_version"]) else str(row["Vehicle_version"]),
                vehicle_generation=None if pd.isna(row["Vehicle_generation"]) else str(row["Vehicle_generation"]),
                production_year=int(row["Production_year"]),
                mileage_km=None if pd.isna(row["Mileage_km"]) else float(row["Mileage_km"]),
                power_hp=None if pd.isna(row["Power_HP"]) else float(row["Power_HP"]),
                displacement_cm3=None if pd.isna(row["Displacement_cm3"]) else float(row["Displacement_cm3"]),
                fuel_type=None if pd.isna(row["Fuel_type"]) else str(row["Fuel_type"]),
                co2_emissions=None if pd.isna(row["CO2_emissions"]) else float(row["CO2_emissions"]),
                drive=None if pd.isna(row["Drive"]) else str(row["Drive"]),
                transmission=None if pd.isna(row["Transmission"]) else str(row["Transmission"]),
                type=None if pd.isna(row["Type"]) else str(row["Type"]),
                doors_number=None if pd.isna(row["Doors_number"]) else float(row["Doors_number"]),
                colour=None if pd.isna(row["Colour"]) else str(row["Colour"]),
                origin_country=None if pd.isna(row["Origin_country"]) else str(row["Origin_country"]),
                first_owner=bool_from_yes_no(row["First_owner"]) if not pd.isna(row["First_owner"]) else None,
                first_registration_date=None if pd.isna(row["First_registration_date"]) else str(row["First_registration_date"]),
                offer_publication_date=None if pd.isna(row["Offer_publication_date"]) else str(row["Offer_publication_date"]),
                offer_location=None if pd.isna(row["Offer_location"]) else str(row["Offer_location"]),
                features=None if pd.isna(row["Features"]) else str(row["Features"]),
            )
            
            # Sprawdź czy rekord już istnieje w bazie
            if offer_id in existing_ids:
                # Aktualizuj istniejący rekord
                existing = db.query(Listing).filter(Listing.id == offer_id).first()
                if existing:
                    for key, value in listing.__dict__.items():
                        if key != '_sa_instance_state' and key != 'id':  # nie aktualizuj ID
                            setattr(existing, key, value)
                    updated += 1
            else:
                # Dodaj nowy rekord
                db.add(listing)
                existing_ids.add(offer_id)  # dodaj do cache
                inserted += 1
            
            # Commit co 1000 rekordów dla lepszej wydajności
            if (inserted + updated) % 1000 == 0:
                db.commit()
                print(f"  Przetworzono {inserted + updated} rekordów... (nowych: {inserted}, zaktualizowanych: {updated})")
                
        except ValueError as e:
            errors += 1
            print(f"  Błąd w linii {idx + 2}: Nieprawidłowa wartość ID - {e}")
            continue
        except Exception as e:
            errors += 1
            print(f"  Błąd w linii {idx + 2}: {e}")
            continue

    # Finalny commit
    try:
        db.commit()
        print(f"\n{'='*50}")
        print(f"Gotowe! Statystyki importu:")
        print(f"  - Nowych rekordów wstawionych: {inserted}")
        print(f"  - Istniejących rekordów zaktualizowanych: {updated}")
        print(f"  - Duplikatów w CSV pominiętych: {skipped}")
        print(f"  - Błędów: {errors}")
        print(f"  - Łącznie przetworzonych: {inserted + updated}")
        print(f"{'='*50}")
    except Exception as e:
        db.rollback()
        print(f"\nBłąd podczas zapisu do bazy: {e}")
    finally:
        db.close()
        print("Baza autotrade.sqlite zaktualizowana.")


if __name__ == "__main__":
    main()
