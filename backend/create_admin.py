"""
Skrypt do tworzenia konta administratora.
Uruchom: python create_admin.py
"""

import sys
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models import User
from app.auth import get_password_hash

def create_admin(username: str, email: str, password: str):
    """Tworzy konto administratora."""
    db: Session = SessionLocal()
    
    try:
        # Sprawdź czy użytkownik już istnieje
        existing_user = db.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()
        
        if existing_user:
            print(f"❌ Użytkownik o nazwie '{username}' lub emailu '{email}' już istnieje!")
            if existing_user.role == "admin":
                print(f"   Użytkownik już ma rolę administratora.")
            else:
                print(f"   Aktualizuję rolę na 'admin'...")
                existing_user.role = "admin"
                existing_user.hashed_password = get_password_hash(password)
                db.commit()
                print(f"✅ Zaktualizowano użytkownika '{username}' na administratora!")
            return
        
        # Utwórz nowego administratora
        hashed_password = get_password_hash(password)
        admin = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            role="admin",
            is_active=True
        )
        
        db.add(admin)
        db.commit()
        db.refresh(admin)
        
        print(f"✅ Utworzono konto administratora:")
        print(f"   Nazwa użytkownika: {username}")
        print(f"   Email: {email}")
        print(f"   Rola: {admin.role}")
        print(f"   ID: {admin.id}")
        print(f"\n💡 Możesz teraz zalogować się używając:")
        print(f"   Username: {username}")
        print(f"   Password: {password}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Błąd podczas tworzenia administratora: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Tworzenie konta administratora")
    print("=" * 60)
    
    # Domyślne wartości (można zmienić)
    username = "admin"
    email = "admin@autotrade.local"
    password = "admin123"
    
    # Można podać argumenty z linii poleceń
    if len(sys.argv) > 1:
        username = sys.argv[1]
    if len(sys.argv) > 2:
        email = sys.argv[2]
    if len(sys.argv) > 3:
        password = sys.argv[3]
    
    print(f"\nTworzenie konta:")
    print(f"  Username: {username}")
    print(f"  Email: {email}")
    print(f"  Password: {'*' * len(password)}")
    print()
    
    create_admin(username, email, password)
    
    print("\n" + "=" * 60)

