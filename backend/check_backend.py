"""
Skrypt do sprawdzania czy backend działa poprawnie.
Uruchom: python check_backend.py
"""

import sys

print("Sprawdzanie importów...")

try:
    print("1. Importowanie FastAPI...")
    from fastapi import FastAPI
    print("   ✓ FastAPI OK")
except Exception as e:
    print(f"   ✗ FastAPI: {e}")
    sys.exit(1)

try:
    print("2. Importowanie SQLAlchemy...")
    from sqlalchemy.orm import Session
    print("   ✓ SQLAlchemy OK")
except Exception as e:
    print(f"   ✗ SQLAlchemy: {e}")
    sys.exit(1)

try:
    print("3. Importowanie jose (JWT)...")
    from jose import JWTError, jwt
    print("   ✓ jose OK")
except Exception as e:
    print(f"   ✗ jose: {e}")
    print("   Zainstaluj: pip install python-jose[cryptography]")
    sys.exit(1)

try:
    print("4. Importowanie passlib...")
    from passlib.context import CryptContext
    print("   ✓ passlib OK")
except Exception as e:
    print(f"   ✗ passlib: {e}")
    print("   Zainstaluj: pip install passlib[bcrypt]")
    sys.exit(1)

try:
    print("5. Importowanie app.db...")
    from app.db import Base, engine, get_db
    print("   ✓ app.db OK")
except Exception as e:
    print(f"   ✗ app.db: {e}")
    sys.exit(1)

try:
    print("6. Importowanie app.models...")
    from app.models import Listing, User, SavedValuation, SavedComparison
    print("   ✓ app.models OK")
except Exception as e:
    print(f"   ✗ app.models: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("7. Importowanie app.auth...")
    from app.auth import get_password_hash, verify_password, create_access_token
    print("   ✓ app.auth OK")
except Exception as e:
    print(f"   ✗ app.auth: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("8. Importowanie app.main...")
    import app.main
    print("   ✓ app.main OK")
except Exception as e:
    print(f"   ✗ app.main: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n✓ Wszystkie importy działają poprawnie!")
print("\nMożesz uruchomić serwer:")
print("  uvicorn app.main:app --reload")

