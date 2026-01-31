# ============================================
# Skrypt bezpiecznego przebudowania AutoTrade
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AutoTrade - Bezpieczne przebudowanie" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Sprawdzenie folderu scrapera
Write-Host "[1/6] Sprawdzanie folderu scrapera..." -ForegroundColor Yellow
$scraperPath = ".\otomoto-webscrape"
$suspiciousExtensions = @("*.exe", "*.msi", "*.bat", "*.cmd", "*.dmg", "*.pkg")
$suspiciousFiles = @()

foreach ($ext in $suspiciousExtensions) {
    $files = Get-ChildItem -Path $scraperPath -Filter $ext -Recurse -ErrorAction SilentlyContinue
    if ($files) {
        $suspiciousFiles += $files
    }
}

# Sprawdź też chromedriver, geckodriver
$driverFiles = Get-ChildItem -Path $scraperPath -Filter "*driver*" -Recurse -ErrorAction SilentlyContinue
if ($driverFiles) {
    $suspiciousFiles += $driverFiles
}

if ($suspiciousFiles.Count -gt 0) {
    Write-Host "[UWAGA] Znaleziono podejrzane pliki:" -ForegroundColor Red
    foreach ($file in $suspiciousFiles) {
        Write-Host "   - $($file.FullName)" -ForegroundColor Red
    }
    $continue = Read-Host "Czy chcesz kontynuowac? (t/n)"
    if ($continue -ne "t") {
        Write-Host "Przerwano." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[OK] Folder scrapera wyglada bezpiecznie" -ForegroundColor Green
}
Write-Host ""

# 2. Sprawdzenie czy Docker działa
Write-Host "[2/6] Sprawdzanie Dockera..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "[OK] Docker dziala: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "[BLAD] Docker nie jest zainstalowany lub nie dziala!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Zatrzymanie i usunięcie starych kontenerów
Write-Host "[3/6] Zatrzymywanie i usuwanie starych kontenerów..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null
Write-Host "[OK] Stare kontenery zatrzymane" -ForegroundColor Green
Write-Host ""

# 4. Przebudowanie obrazów bez cache
Write-Host "[4/6] Przebudowywanie obrazów Dockera (bez cache)..." -ForegroundColor Yellow
Write-Host "To może zająć kilka minut..." -ForegroundColor Gray

$buildResult = docker-compose build --no-cache 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Obrazy przebudowane pomyslnie" -ForegroundColor Green
} else {
    Write-Host "[BLAD] Blad podczas budowania obrazow!" -ForegroundColor Red
    Write-Host $buildResult
    exit 1
}
Write-Host ""

# 5. Wybór trybu uruchomienia
Write-Host "[5/6] Wybór trybu uruchomienia..." -ForegroundColor Yellow
Write-Host "1. Development (hot reload, porty 8000 i 5173)"
Write-Host "2. Production (zoptymalizowane, porty 8000 i 80)"
$mode = Read-Host "Wybierz tryb (1 lub 2)"

if ($mode -eq "1") {
    $composeFile = "docker-compose.dev.yml"
    Write-Host "[OK] Uruchamiam w trybie Development" -ForegroundColor Green
} else {
    $composeFile = "docker-compose.yml"
    Write-Host "[OK] Uruchamiam w trybie Production" -ForegroundColor Green
}
Write-Host ""

# 6. Uruchomienie kontenerów
Write-Host "[6/6] Uruchamianie kontenerów..." -ForegroundColor Yellow
docker-compose -f $composeFile up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Kontenery uruchomione" -ForegroundColor Green
} else {
    Write-Host "[BLAD] Blad podczas uruchamiania kontenerow!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 7. Weryfikacja działania
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Weryfikacja działania..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Czekaj 10 sekund na start
Write-Host "Czekam 10 sekund na start serwisów..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# Sprawdź status kontenerów
Write-Host "Status kontenerów:" -ForegroundColor Yellow
docker-compose -f $composeFile ps
Write-Host ""

# Sprawdź logi backendu
Write-Host "Ostatnie logi backendu:" -ForegroundColor Yellow
docker-compose -f $composeFile logs --tail=20 backend
Write-Host ""

# Test połączenia z API
Write-Host "Test połączenia z API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "[OK] API dziala poprawnie!" -ForegroundColor Green
        Write-Host "   Odpowiedz: $($response.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "[INFO] API jeszcze nie odpowiada (moze potrzebowac wiecej czasu)" -ForegroundColor Yellow
    Write-Host "   Sprobuj ponownie za chwile: curl http://localhost:8000/health" -ForegroundColor Gray
}
Write-Host ""

# Podsumowanie
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Podsumowanie" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
if ($mode -eq "1") {
    Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "Frontend: http://localhost" -ForegroundColor Green
}
Write-Host "Backend API: http://localhost:8000" -ForegroundColor Green
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Przydatne komendy:" -ForegroundColor Yellow
Write-Host "  - Logi: docker-compose -f $composeFile logs -f" -ForegroundColor Gray
Write-Host "  - Status: docker-compose -f $composeFile ps" -ForegroundColor Gray
Write-Host "  - Stop: docker-compose -f $composeFile down" -ForegroundColor Gray
Write-Host ""
Write-Host "[OK] Gotowe!" -ForegroundColor Green
