# Skrypt instalacji backendu dla Windows PowerShell
# Uruchom: .\setup_backend.ps1

Write-Host "=== Instalacja zależności backendu ===" -ForegroundColor Cyan

# Sprawdź czy Python jest dostępny
try {
    $pythonVersion = python --version
    Write-Host "Znaleziono: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "BŁĄD: Python nie jest zainstalowany lub nie jest w PATH" -ForegroundColor Red
    exit 1
}

# Sprawdź czy jest wirtualne środowisko w głównym katalogu projektu
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VenvPath = Join-Path $ProjectRoot "venv"

if (Test-Path "$VenvPath\Scripts\Activate.ps1") {
    Write-Host "`nWirtualne środowisko już istnieje w głównym katalogu projektu." -ForegroundColor Yellow
    Write-Host "Aktywuję wirtualne środowisko..." -ForegroundColor Cyan
    & "$VenvPath\Scripts\Activate.ps1"
} else {
    Write-Host "`nTworzenie wirtualnego środowiska w głównym katalogu projektu..." -ForegroundColor Cyan
    Set-Location $ProjectRoot
    python -m venv venv
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "BŁĄD: Nie udało się utworzyć wirtualnego środowiska" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Aktywuję wirtualne środowisko..." -ForegroundColor Cyan
    & "$VenvPath\Scripts\Activate.ps1"
    Set-Location $PSScriptRoot
}

# Zainstaluj zależności
Write-Host "`nInstalowanie zależności z requirements.txt..." -ForegroundColor Cyan
pip install --upgrade pip
pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "BŁĄD: Nie udało się zainstalować zależności" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Sprawdzanie instalacji ===" -ForegroundColor Cyan
python check_backend.py

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Wszystko gotowe!" -ForegroundColor Green
    Write-Host "`nMożesz teraz uruchomić serwer:" -ForegroundColor Cyan
    Write-Host "  uvicorn app.main:app --reload" -ForegroundColor Yellow
} else {
    Write-Host "`n✗ Wystąpiły błędy podczas sprawdzania" -ForegroundColor Red
    exit 1
}

