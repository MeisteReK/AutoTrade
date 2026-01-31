# Instalacja backendu

## Problem: Backend nie działa

Jeśli backend się nie uruchamia, najczęściej brakuje zainstalowanych pakietów.

## Rozwiązanie

### Opcja 1: Venv (polecam)

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Venv jest lepsze, bo nie miesza pakietów z globalnymi instalacjami Pythona.

### Opcja 2: Globalnie (nie polecam)

```powershell
cd backend
pip install -r requirements.txt
```

Może powodować konflikty z innymi projektami.

## Uruchomienie

Po zainstalowaniu pakietów:

```powershell
# Pamiętaj o venv!
venv\Scripts\Activate.ps1
cd backend
uvicorn app.main:app --reload
```

Flaga `--reload` powoduje automatyczne przeładowanie przy zmianach w kodzie (przydatne przy developmencie).

## Sprawdzenie

Zanim uruchomisz serwer, możesz sprawdzić czy wszystkie importy działają:

```powershell
python check_backend.py
```

Jeśli wszystko OK, możesz uruchomić serwer. Jeśli są błędy importów, prawdopodobnie brakuje jakiegoś pakietu - sprawdź `requirements.txt` i zainstaluj brakujące.
