# Testy Backendu

## Uruchomienie testów

```bash
# Wszystkie testy
pytest

# Testy z verbose output
pytest -v

# Testy konkretnego pliku
pytest tests/test_auth.py

# Testy konkretnej funkcji
pytest tests/test_auth.py::test_login_success

# Testy z coverage
pytest --cov=app --cov-report=html
```

## Struktura testów

- `test_auth.py` - testy autentykacji i autoryzacji
- `test_api.py` - testy endpointów API
- `test_crud.py` - testy funkcji CRUD
- `conftest.py` - wspólne fixtures i konfiguracja

## Używane biblioteki

- **pytest** - framework testowy
- **httpx** - klient HTTP do testowania API
- **TestClient** - FastAPI test client

## Fixtures

- `db` - testowa baza danych (SQLite in-memory)
- `client` - testowy klient FastAPI
- `test_user` - przykładowy użytkownik
- `test_admin` - przykładowy administrator
- `auth_headers` - nagłówki z tokenem JWT
- `admin_headers` - nagłówki z tokenem admina
- `sample_listings` - przykładowe oferty w bazie

