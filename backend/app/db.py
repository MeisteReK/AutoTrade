from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:///./autotrade.sqlite"


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,  # wymagane dla SQLite + wielu wątków
        "timeout": 30,  # Timeout dla operacji na bazie (30 sekund)
    },
    pool_pre_ping=True,  # Sprawdza połączenie przed użyciem
)

# Optymalizacje SQLite dla lepszej wydajności (szczególnie w Dockerze)
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """
    Ustawia optymalizacje SQLite przy każdym połączeniu:
    - WAL mode: szybsze zapisy, lepsza współbieżność
    - NORMAL synchronous: szybsze niż FULL, bezpieczniejsze niż OFF
    - Większy cache: 64MB w pamięci
    - Tymczasowe tabele w pamięci: szybsze operacje
    """
    cursor = dbapi_conn.cursor()
    try:
        # Write-Ahead Logging - szybsze zapisy i lepsza współbieżność
        cursor.execute("PRAGMA journal_mode=WAL")
        # Synchronous NORMAL - kompromis między szybkością a bezpieczeństwem
        cursor.execute("PRAGMA synchronous=NORMAL")
        # Cache 64MB w pamięci (ujemna wartość = KB, więc -64000 = 64MB)
        cursor.execute("PRAGMA cache_size=-64000")
        # Tymczasowe tabele w pamięci zamiast na dysku
        cursor.execute("PRAGMA temp_store=MEMORY")
        # Optymalizacja zapytań
        cursor.execute("PRAGMA optimize")
    except Exception:
        # Ignoruj błędy PRAGMA (np. jeśli baza jest tylko do odczytu)
        pass
    finally:
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
