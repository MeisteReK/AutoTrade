# Autentykacja i użytkownicy

## Gdzie są zapisywani użytkownicy?

Wszystko w bazie SQLite (`autotrade.sqlite`) w tabeli `users`. Plik jest w katalogu backend.

### Struktura tabeli users:
- `id` - ID użytkownika
- `username` - nazwa (unikalna)
- `email` - email (unikalny)
- `hashed_password` - hasło zahashowane bcrypt
- `role` - "user" lub "admin"
- `is_active` - czy konto aktywne
- `created_at` - kiedy utworzone

## Jak zrobić konto admina?

### Szybki sposób - skrypt

```powershell
cd backend
venv\Scripts\Activate.ps1
python create_admin.py
```

Domyślnie tworzy: admin/admin123

Z własnymi danymi:
```powershell
python create_admin.py mojanazwa email@example.com haslo123
```

### Przez API + zmiana roli

1. Zarejestruj się normalnie przez frontend lub API:
```bash
POST http://127.0.0.1:8000/auth/register
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "admin123"
}
```

2. Zmień rolę w bazie (Python):
```python
from app.db import SessionLocal
from app.models import User

db = SessionLocal()
user = db.query(User).filter(User.username == "admin").first()
user.role = "admin"
db.commit()
```

### Ręcznie w bazie

Otwórz `autotrade.sqlite` w DB Browser for SQLite (lub innym narzędziu) i zmień `role` na "admin" dla wybranego użytkownika.

## Jak się zalogować jako admin?

1. Uruchom backend:
```powershell
uvicorn app.main:app --reload
```

2. Otwórz frontend w przeglądarce

3. Zakładka "Logowanie" -> wpisz dane admina

4. Po zalogowaniu zobaczysz:
   - Zakładkę "Admin" (tylko dla adminów)
   - Zakładkę "Zapisane" (dla wszystkich zalogowanych)
   - W prawym górnym rogu: `(Admin)`

## Co może admin?

**W aplikacji:**
- Panel administratora:
  - Konfiguracja scrapera
  - Uruchamianie aktualizacji bazy
  - Monitorowanie statusu
  - Reset statusu
  - Import CSV

**API endpoints:**
- `DELETE /admin/listings/{id}` - usuwanie ofert
- `POST /admin/database/full-update` - uruchomienie aktualizacji
- `GET /admin/database/update-status` - status
- `POST /admin/database/reset-status` - reset

## Bezpieczeństwo

Ważne rzeczy:
- W produkcji ZMIEŃ domyślne hasło admina!
- Użyj silnego hasła
- Rozważ zmienną środowiskową dla `SECRET_KEY` (JWT)
- Nie commituj bazy danych do repo (jest w .gitignore)

## Sprawdzanie użytkowników

Jeśli chcesz zobaczyć wszystkich użytkowników:

```python
from app.db import SessionLocal
from app.models import User

db = SessionLocal()
users = db.query(User).all()

for user in users:
    print(f"ID: {user.id}, Username: {user.username}, Email: {user.email}, Role: {user.role}")
```
