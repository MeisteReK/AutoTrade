# AutoTrade Analytics

Aplikacja do analizy i wyceny pojazdów na podstawie danych z otomoto.pl. Backend w FastAPI, frontend w React + TypeScript.

## Pobieranie projektu

Projekt jest dostępny w repozytorium Git:

```bash
# Sklonuj repozytorium
git clone https://github.com/TWOJA-NAZWA-UŻYTKOWNIKA/AutoTrade.git

# Przejdź do katalogu projektu
cd AutoTrade
```

**Uwaga:** Zastąp `TWOJA-NAZWA-UŻYTKOWNIKA` nazwą użytkownika lub organizacji w repozytorium Git.

## Co jest potrzebne

- Docker i Docker Compose (zalecane)
- Lub Python 3.11+ (3.11, 3.12, 3.14 sprawdzone) i Node.js 16+ (dla lokalnej instalacji)

## Jak uruchomić

### Opcja 1: Docker (zalecane dla produkcji)

Najprostszy sposób - wszystko w kontenerach:

```bash
# Produkcja
docker-compose up -d

# Development (z hot reload)
docker-compose -f docker-compose.dev.yml up
```

Aplikacja będzie dostępna:
- Frontend: http://localhost (produkcja) lub http://localhost:5173 (dev)
- Backend: http://localhost:8000

**Pierwsze uruchomienie po sklonowaniu z Git:**
```bash
# 1. Zbuduj obrazy
docker-compose build

# 2. Uruchom kontenery
docker-compose up -d

# 3. Inicjalizuj bazę danych (tylko raz)
docker-compose exec backend python init_db.py

# 4. Utwórz konto admina (tylko raz)
docker-compose exec backend python create_admin.py
```

**Uwaga:** Domyślny SECRET_KEY jest ustawiony dla developmentu. W produkcji ustaw własny klucz w zmiennej środowiskowej SECRET_KEY.

**Przydatne komendy:**
```bash
# Zatrzymaj kontenery
docker-compose down

# Zobacz logi
docker-compose logs -f

# Restart
docker-compose restart

# Wejdź do kontenera backendu
docker-compose exec backend bash
```

Więcej o Dockerze: zobacz sekcję "Docker" poniżej.

### Opcja 2: Lokalnie (development)

### Backend

Najpierw trzeba zainstalować zależności. Polecam używać venv, żeby nie mieszać z globalnymi pakietami:

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Potem inicjalizacja bazy danych:

```powershell
python init_db.py
```

Jeśli chcesz mieć konto admina od razu (domyślnie admin/admin123):

```powershell
python create_admin.py
```

Albo z własnymi danymi:
```powershell
python create_admin.py mojanazwa moj@email.com mojehaslo
```

Uruchomienie serwera:

```powershell
# Pamiętaj o aktywacji venv!
venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

Serwer powinien działać na http://127.0.0.1:8000. Dokumentacja API jest dostępna pod /docs (Swagger) i /redoc.

### Frontend

Instalacja zależności:

```powershell
cd frontend
npm install
https://github.com/bpieniak/otomoto-webscrape```

Uruchomienie:

```powershell
npm run dev
```

Aplikacja powinna być dostępna na http://localhost:5173.

Do budowania wersji produkcyjnej:
```powershell
npm run build
```

## Struktura projektu

```
AutoTrade/
├── backend/              # FastAPI backend
│   ├── app/             
│   │   ├── main.py      # Główny plik FastAPI
│   │   ├── models.py    # Modele SQLAlchemy
│   │   ├── schemas.py   # Pydantic schemas
│   │   ├── crud.py      # Operacje na bazie
│   │   ├── auth.py      # Logowanie/rejestracja
│   │   └── ...
│   ├── autotrade.sqlite # Baza SQLite
│   └── requirements.txt
│
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  
│   │   ├── context/    
│   │   ├── types/      
│   │   └── ...
│   └── package.json    
│
└── otomoto-webscrape/  # Scraper
    ├── main.py         
    └── scraped_data/   
```

## Co można robić

**Dla wszystkich:**
- Przeglądanie ofert z filtrowaniem
- Wykresy i statystyki cen
- Wycena pojazdu (model ML)
- Porównywanie dwóch pojazdów

**Dla zalogowanych:**
- Zapisywanie wycen i porównań
- Historia zapisanych analiz

**Dla adminów:**
- Konfiguracja scrapera
- Uruchamianie aktualizacji bazy
- Monitorowanie scrapowania
- Import CSV

## Logowanie i rejestracja

Rejestracja przez frontend - zakładka "Logowanie". Wymagania:
- Nazwa użytkownika: min. 3 znaki
- Email: poprawny format
- Hasło: min. 8 znaków, wielka litera, mała litera, cyfra, znak specjalny

Konto admina można utworzyć przez:
```powershell
python backend/create_admin.py
```

## Problemy i rozwiązania

**Backend nie startuje:**
- Sprawdź czy venv jest aktywny (`venv\Scripts\Activate.ps1`)
- Zainstaluj zależności: `pip install -r requirements.txt`
- Sprawdź czy baza istnieje: `python init_db.py`
- Port 8000 może być zajęty - zmień w kodzie lub zabij proces

**Frontend nie startuje:**
- Sprawdź Node.js: `node --version`
- Zainstaluj zależności: `npm install`
- Port 5173 może być zajęty

**Błąd połączenia z API:**
- Sprawdź czy backend działa (http://127.0.0.1:8000)
- Sprawdź `frontend/src/config/api.ts`
- CORS może blokować - sprawdź konfigurację w backendzie

**Importy nie działają:**
```powershell
python backend/check_backend.py
```

## Aktualizacja bazy danych

**Przez panel admina:**
1. Zaloguj się jako admin
2. Panel administratora -> skonfiguruj scraper
3. Uruchom aktualizację

**Import CSV:**
1. Uruchom scraper ręcznie (zobacz `otomoto-webscrape/README.md`)
2. W panelu admina wybierz "Import CSV do bazy"
3. Wybierz plik i zaimportuj

## Używane technologie

**Backend:**
- FastAPI
- SQLAlchemy
- Pydantic
- JWT
- Pandas, NumPy

**Frontend:**
- React 19
- TypeScript
- Vite
- Chart.js
- Axios

## Docker

### Szybki start

```bash
# Produkcja
docker-compose up -d

# Development (hot reload)
docker-compose -f docker-compose.dev.yml up
```

### Pierwsze uruchomienie

1. **Zbuduj obrazy:**
   ```bash
   docker-compose build
   ```

2. **Uruchom kontenery:**
   ```bash
   docker-compose up -d
   ```

3. **Inicjalizuj bazę danych (tylko raz):**
   ```bash
   docker-compose exec backend python init_db.py
   ```

4. **Utwórz konto admina (tylko raz):**
   ```bash
   docker-compose exec backend python create_admin.py
   ```

### Przydatne komendy

```bash
# Zatrzymaj kontenery
docker-compose down

# Zatrzymaj i usuń volumes (UWAGA: usuwa bazę danych!)
docker-compose down -v

# Zobacz logi
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart konkretnego serwisu
docker-compose restart backend

# Wejdź do kontenera
docker-compose exec backend bash
docker-compose exec frontend sh

# Sprawdź status
docker-compose ps

# Przebuduj po zmianach w kodzie
docker-compose build --no-cache
docker-compose up -d
```

### Development vs Production

**Development** (`docker-compose.dev.yml`):
- Hot reload - zmiany w kodzie widoczne od razu
- Porty: 8000 (backend), 5173 (frontend)
- Volumes z kodem źródłowym

**Production** (`docker-compose.yml`):
- Zbudowany frontend (statyczne pliki)
- Nginx zamiast Vite dev server
- Porty: 8000 (backend), 80 (frontend)
- Szybsze, gotowe do wdrożenia

### Volumes (dane)

Dane są zapisywane w volumes, więc przetrwają restart:
- `backend/autotrade.sqlite` - baza danych
- `backend/scraper_config.json` - konfiguracja scrapera
- `backend/update_status.json` - status aktualizacji
- `backend/update_history.json` - historia
- `backend/models/` - modele ML

### Backup

Aby zrobić backup, po prostu skopiuj pliki z volumes:
```bash
# Backup bazy danych
cp backend/autotrade.sqlite backup/autotrade.sqlite.backup

# Backup całego backendu
cp -r backend/ backup/backend/
```

### Problemy z Dockerem

**Kontenery nie startują:**
```bash
# Sprawdź logi
docker-compose logs

# Sprawdź czy porty są wolne
netstat -an | findstr "8000"
netstat -an | findstr "80"
```

**Baza danych nie działa:**
```bash
# Sprawdź czy plik istnieje
ls backend/autotrade.sqlite

# Sprawdź uprawnienia (Linux/Mac)
chmod 666 backend/autotrade.sqlite
```

**Frontend nie łączy się z backendem:**
- Sprawdź czy backend działa: `docker-compose ps`
- Sprawdź logi backendu: `docker-compose logs backend`
- Sprawdź CORS w zmiennych środowiskowych

**Zmiany w kodzie nie działają (production):**
- W produkcji kod jest skopiowany do obrazu
- Trzeba przebudować: `docker-compose build && docker-compose up -d`
- W dev mode zmiany są widoczne od razu

### Zmienne środowiskowe

Możesz utworzyć plik `.env` w głównym katalogu:
```env
SECRET_KEY=twoj-secret-key-tutaj
CORS_ORIGINS=http://localhost,http://127.0.0.1
VITE_API_URL=http://localhost:8000
```

## Testy

### Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest
```

Więcej informacji: `backend/tests/README.md`

### Frontend

```powershell
cd frontend
npm install
npm run test
```

Więcej informacji: `frontend/src/test/README.md`

## Dodatkowe pliki

- `backend/INSTALL.md` - więcej o instalacji backendu
- `backend/README_AUTH.md` - szczegóły autentykacji
- `backend/tests/README.md` - instrukcje testów backendu
- `frontend/README.md` - info o frontendzie (standardowy template Vite)
- `frontend/src/test/README.md` - instrukcje testów frontendu
