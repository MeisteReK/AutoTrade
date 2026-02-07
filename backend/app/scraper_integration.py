"""
Moduł integracji ze scraperem otomoto-webscrape.
Obsługuje uruchamianie scrapera i aktualizację bazy danych.
Proces może trwać do 2 dni.
"""

import subprocess
import shutil
import logging
import json
import threading
import time
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime
import os
import uuid
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

# Globalna referencja do uruchomionego procesu (dla możliwości anulowania)
# Uproszczone: używamy tylko pliku JSON do zarządzania stanem
_current_process: Optional[subprocess.Popen] = None
_process_lock = threading.Lock()

# Ścieżki - względne do struktury projektu
BACKEND_DIR = Path(__file__).parent.parent  # backend/
# otomoto-webscrape jest w tym samym katalogu co backend
# backend/app/ -> backend/ -> AutoTrade/ -> otomoto-webscrape/
# W Dockerze: /otomoto-webscrape (z volume mount)
# Lokalnie: AutoTrade/otomoto-webscrape
if Path("/.dockerenv").exists():
    # W kontenerze Docker: użyj ścieżki z volume mount
    SCRAPER_DIR = Path("/otomoto-webscrape")
else:
    # Lokalnie: użyj względnej ścieżki
    SCRAPER_DIR = BACKEND_DIR.parent / "otomoto-webscrape"
SCRAPER_CSV = SCRAPER_DIR / "car_sale_ads.csv"
TARGET_CSV = BACKEND_DIR / "data" / "car_sale_ads.csv"
STATUS_FILE = BACKEND_DIR / "update_status.json"  # Status w pliku (przetrwa restart)
HISTORY_FILE = BACKEND_DIR / "update_history.json"  # Historia wszystkich scrapów
SCRAPER_LOG_FILE = BACKEND_DIR / "scraper.log"  # Plik z logami scrapera


def save_status(status_data: Dict):
    """Zapisuje status do pliku JSON i dodaje do historii."""
    status_data["last_updated"] = datetime.utcnow().isoformat()
    try:
        # Zapisz aktualny status
        with open(STATUS_FILE, "w", encoding="utf-8") as f:
            json.dump(status_data, f, indent=2)
        
        # Dodaj do historii (jeśli ma ID)
        if "id" in status_data:
            history = load_history()
            # Znajdź istniejący rekord lub dodaj nowy
            existing_index = None
            for i, record in enumerate(history):
                if record.get("id") == status_data["id"]:
                    existing_index = i
                    break
            
            if existing_index is not None:
                # Aktualizuj istniejący rekord
                history[existing_index] = status_data
            else:
                # Dodaj nowy rekord na początku listy
                history.insert(0, status_data)
            
            # Zachowaj tylko ostatnie 50 rekordów
            history = history[:50]
            
            # Zapisz historię
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(history, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving status: {e}")


def load_status() -> Dict:
    """Wczytuje aktualny status z pliku."""
    if STATUS_FILE.exists():
        try:
            with open(STATUS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading status: {e}")
    
    return {
        "status": "idle",
        "current_step": None,
        "progress_percent": 0,
        "started_at": None,
        "completed_at": None,
        "error_message": None,
        "steps_completed": [],
        "steps_failed": []
    }


def load_history() -> List[Dict]:
    """Wczytuje historię wszystkich scrapów."""
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading history: {e}")
    
    return []


def cancel_update():
    """Anuluje uruchomiony proces aktualizacji."""
    global _current_process
    
    logger.info("Cancel update requested...")
    
    # Ustaw flagę anulowania w statusie (jeden źródło prawdy)
    status = load_status()
    if status["status"] != "running":
        logger.warning(f"Cannot cancel: status is '{status['status']}', not 'running'")
        return
    
    # Zapisz flagę anulowania w statusie
    status["cancelled"] = True
    save_status(status)
    
    # Anuluj proces jeśli istnieje
    with _process_lock:
        if _current_process is not None:
            try:
                logger.info("Terminating scraper process...")
                _current_process.terminate()
                logger.info("Terminate signal sent")
            except Exception as e:
                logger.error(f"Error sending terminate signal: {e}")
        else:
            logger.warning("No process to cancel (process is None)")


def is_cancelled() -> bool:
    """Sprawdza czy proces został anulowany (z pliku statusu)."""
    status = load_status()
    return status.get("cancelled", False)


def is_process_running() -> bool:
    """Sprawdza czy proces aktualizacji faktycznie działa."""
    global _current_process
    with _process_lock:
        if _current_process is None:
            return False
        try:
            # Sprawdź czy proces jeszcze działa
            poll_result = _current_process.poll()
            return poll_result is None  # None oznacza że proces jeszcze działa
        except:
            return False


def run_full_update(start_step: str = "scraping", steps_to_run: Optional[List[str]] = None) -> Dict:
    """
    Uruchamia pełny proces aktualizacji (może trwać 2 dni).
    Status jest zapisywany do pliku po każdym kroku.
    
    Args:
        start_step: Etap od którego zacząć (scraping, processing, database_update)
        steps_to_run: Lista etapów do wykonania (None = wszystkie od start_step)
    
    Returns:
        Dict ze statusem procesu
    """
    global _current_process
    
    # Reset flagi anulowania w statusie
    status = load_status()
    if status.get("cancelled"):
        status["cancelled"] = False
        save_status(status)
    
    # Generuj unikalne ID dla tego scrapa
    update_id = str(uuid.uuid4())
    
    # Jeśli steps_to_run nie jest podane, wykonaj wszystkie od start_step
    # Uwaga: "copying" jest teraz częścią "processing"
    all_steps = ["scraping", "processing", "database_update"]
    if steps_to_run is None:
        start_index = all_steps.index(start_step) if start_step in all_steps else 0
        steps_to_run = all_steps[start_index:]
    
    # Zapisz timestamp rozpoczęcia (do sprawdzania które pliki zostały zescrapowane)
    scraping_start_time = datetime.utcnow()
    
    status = {
        "id": update_id,
        "status": "running",
        "current_step": None,
        "progress_percent": 0,
        "started_at": scraping_start_time.isoformat(),
        "completed_at": None,
        "error_message": None,
        "steps_completed": [],
        "steps_failed": [],
        "steps_to_run": steps_to_run,
        "start_step": start_step,
        "n_offers_scraped": None,  # Będzie wypełnione po scrapowaniu
        "last_updated": None,
        "cancelled": False,  # Flaga anulowania w statusie
        "process_pid": None,  # PID procesu (będzie wypełnione)
        "scraping_start_timestamp": scraping_start_time.timestamp()  # Timestamp do sprawdzania nowych plików
    }
    save_status(status)
    
    # Mapowanie etapów na funkcje (usunięto model_training - model trenowany na żądanie dla konkretnej marki/modelu)
    # Uwaga: "copying" jest teraz częścią "processing"
    steps_order = ["scraping", "processing", "database_update"]
    start_index = steps_order.index(start_step) if start_step in steps_order else 0
    
    # Oznacz poprzednie kroki jako ukończone jeśli zaczynamy od późniejszego etapu
    if start_index > 0:
        status["steps_completed"] = steps_order[:start_index]
        logger.info(f"Starting from step: {start_step} (skipping steps: {', '.join(steps_order[:start_index])})")
    
    logger.info(f"Update ID: {update_id}, Steps to run: {steps_to_run}")
    
    # Definiuj ścieżki do Python (potrzebne w kilku krokach)
    import sys
    import platform
    import shutil
    
    # Sprawdź czy jesteśmy w kontenerze Docker
    is_docker = Path("/.dockerenv").exists()
    
    if is_docker:
        # W kontenerze Docker: użyj systemowego Pythona (python3)
        # Sprawdź czy python3 jest dostępny w PATH
        python_cmd = shutil.which("python3") or shutil.which("python") or sys.executable
        scraper_python = Path(python_cmd) if python_cmd else Path(sys.executable)
        backend_python = Path(python_cmd) if python_cmd else Path(sys.executable)
        logger.info(f"[DOCKER] Using system Python: {scraper_python}")
        logger.info(f"[DOCKER] Python exists: {scraper_python.exists()}")
        logger.info(f"[DOCKER] Scraper dir: {SCRAPER_DIR}")
        logger.info(f"[DOCKER] Scraper dir exists: {SCRAPER_DIR.exists()}")
    elif platform.system() != "Windows":
        # Linux/Mac (nie Docker): użyj systemowego Pythona
        python_cmd = shutil.which("python3") or shutil.which("python") or sys.executable
        scraper_python = Path(python_cmd) if python_cmd else Path(sys.executable)
        backend_python = Path(python_cmd) if python_cmd else Path(sys.executable)
        logger.info(f"[LINUX/MAC] Using system Python: {scraper_python}")
    else:
        # Windows: spróbuj venv
        scraper_python = SCRAPER_DIR / ".venv" / "Scripts" / "python.exe"
        project_root = BACKEND_DIR.parent  # AutoTrade/
        backend_python = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
        
        # Fallback: jeśli scraper venv nie istnieje, użyj venv z backendu
        if not scraper_python.exists():
            logger.warning(f"Scraper venv not found at {scraper_python}, using backend venv instead")
            scraper_python = backend_python
        
        if not backend_python.exists():
            # Fallback: użyj bieżącego interpretera Python
            backend_python = Path(sys.executable)
            if not scraper_python.exists() or scraper_python == SCRAPER_DIR / ".venv" / "Scripts" / "python.exe":
                scraper_python = backend_python
    
    try:
        # Krok 1: Scrapowanie (najdłuższe - może trwać ~1.5 dnia)
        if "scraping" in steps_to_run:
            logger.info("=" * 60)
            logger.info("Step 1/5: Starting scraper (this may take 1-2 days)")
            logger.info("=" * 60)
            
            status["current_step"] = "scraping"
            status["progress_percent"] = 5
            save_status(status)
            
            if not scraper_python.exists():
                raise FileNotFoundError(
                    f"Python interpreter not found: {scraper_python}\n"
                    f"Please ensure either:\n"
                    f"1. Scraper venv exists at: {SCRAPER_DIR / '.venv' / 'Scripts' / 'python.exe'}\n"
                    f"2. Backend venv exists at: {backend_python}\n"
                    f"3. Or Python is available in system PATH"
                )
            
            # Sprawdź czy nie został anulowany przed uruchomieniem
            if is_cancelled():
                status["status"] = "cancelled"
                status["error_message"] = "Proces został anulowany przed uruchomieniem"
                save_status(status)
                return status
            
            # Otwórz plik do zapisu logów
            log_file = open(SCRAPER_LOG_FILE, "w", encoding="utf-8")
            log_file.write(f"=== Scraper log started at {datetime.now().isoformat()} ===\n")
            log_file.flush()
            
            # Sprawdź jeszcze raz czy nie został anulowany (przed uruchomieniem procesu)
            if is_cancelled():
                logger.warning("Process was cancelled before starting subprocess")
                status["status"] = "cancelled"
                status["error_message"] = "Proces został anulowany przed uruchomieniem"
                status["completed_at"] = datetime.utcnow().isoformat()
                save_status(status)
                log_file.close()
                return status
            
            # PROSTE ROZWIĄZANIE: ZAPISZ KONFIGURACJĘ DO PLIKU W KATALOGU SCRAPERA
            config_file_path = BACKEND_DIR / "scraper_config.json"
            scraper_config_path = SCRAPER_DIR / "scraper_config.json"
            
            logger.info(f"=== KONFIGURACJA SCRAPERA ===")
            logger.info(f"Backend config file: {config_file_path}")
            logger.info(f"Backend config exists: {config_file_path.exists()}")
            logger.info(f"Scraper config path: {scraper_config_path}")
            logger.info(f"Scraper dir exists: {SCRAPER_DIR.exists()}")
            logger.info(f"Scraper dir: {SCRAPER_DIR}")
            
            # Wczytaj konfigurację z backendu
            config_data = None
            if config_file_path.exists():
                try:
                    with open(config_file_path, "r", encoding="utf-8") as f:
                        config_data = json.load(f)
                    logger.info(f"✓ Loaded config: brands={config_data.get('brands_to_scrape')}, max_offers={config_data.get('max_offers_per_brand')}")
                except Exception as e:
                    logger.error(f"Error loading config file: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                logger.error(f"✗ Config file does not exist: {config_file_path}")
            
            # UPEWNIJ SIĘ, ŻE KATALOG SCRAPERA ISTNIEJE
            if not SCRAPER_DIR.exists():
                logger.error(f"✗✗✗ Scraper directory does not exist: {SCRAPER_DIR}")
                raise FileNotFoundError(f"Scraper directory not found: {SCRAPER_DIR}")
            
            # ZAPISZ KONFIGURACJĘ DO PLIKU W KATALOGU SCRAPERA (NAD PISZ!)
            # TO JEST KRYTYCZNE - PLIK MUSI BYĆ W KATALOGU SCRAPERA!
            if config_data:
                try:
                    # Prosty zapis bezpośrednio do pliku
                    logger.info(f"Zapisuję konfigurację do: {scraper_config_path}")
                    with open(scraper_config_path, "w", encoding="utf-8") as f:
                        json.dump(config_data, f, indent=2, ensure_ascii=False)
                        f.flush()  # Wymuś zapis (PRZED zamknięciem pliku!)
                        if hasattr(f, 'fileno'):
                            try:
                                os.fsync(f.fileno())  # Wymuś zapis na dysk
                            except (OSError, AttributeError):
                                pass  # Niektóre systemy plików nie obsługują fsync
                    
                    # SPRAWDŹ CZY PLIK ZOSTAŁ ZAPISANY!
                    if not scraper_config_path.exists():
                        raise FileNotFoundError(f"Plik nie został zapisany! {scraper_config_path}")
                    
                    file_size = scraper_config_path.stat().st_size
                    if file_size == 0:
                        raise ValueError(f"Plik jest pusty! {scraper_config_path}")
                    
                    logger.info(f"✓✓✓ Config file WRITTEN to {scraper_config_path}")
                    logger.info(f"✓✓✓ File exists: {scraper_config_path.exists()}")
                    logger.info(f"✓✓✓ File size: {file_size} bytes")
                    
                    # Sprawdź zawartość
                    with open(scraper_config_path, "r", encoding="utf-8") as f:
                        verify_config = json.load(f)
                    logger.info(f"✓✓✓ Verified: brands={verify_config.get('brands_to_scrape')}, max_offers={verify_config.get('max_offers_per_brand')}")
                    
                    # KRYTYCZNE: Jeśli plik nie istnieje, NIE URUCHAMIAJ SCRAPERA!
                    if not scraper_config_path.exists():
                        error_msg = f"KRYTYCZNY BŁĄD: Plik konfiguracyjny nie został zapisany do {scraper_config_path}"
                        logger.error(f"✗✗✗ {error_msg}")
                        raise FileNotFoundError(error_msg)
                        
                except Exception as e:
                    logger.error(f"✗✗✗ Error writing config file: {e}")
                    import traceback
                    traceback.print_exc()
                    # To jest błąd krytyczny - nie uruchamiaj scrapera bez konfiguracji!
                    raise
            else:
                error_msg = "Brak danych konfiguracyjnych do zapisania!"
                logger.error(f"✗✗✗ {error_msg}")
                raise ValueError(error_msg)
            
            # UPEWNIJ SIĘ, ŻE PLIK ISTNIEJE PRZED URUCHOMIENIEM SCRAPERA!
            if not scraper_config_path.exists():
                error_msg = f"KRYTYCZNY BŁĄD: Plik konfiguracyjny nie istnieje: {scraper_config_path}"
                logger.error(f"✗✗✗ {error_msg}")
                raise FileNotFoundError(error_msg)
            
            # UŻYJ PROSTEGO SKRYPTU, KTÓRY NA PEWNO WCZYTA KONFIGURACJĘ
            # W kontenerze Docker używaj "python3" zamiast pełnej ścieżki
            if is_docker:
                # W Dockerze użyj "python3" z PATH
                python_exec = "python3"
            else:
                # Lokalnie użyj pełnej ścieżki
                python_exec = str(scraper_python)
            
            cmd = [python_exec, "-u", "scrape_otomoto_simple.py"]
            
            env = os.environ.copy()
            env["SCRAPER_CONFIG_FILE"] = str(scraper_config_path.resolve())
            
            # Logi zapisujemy do pliku i wyświetlamy w czasie rzeczywistym
            logger.info(f"Starting scraper process: {' '.join(cmd)}")
            logger.info(f"Working directory: {SCRAPER_DIR}")
            logger.info(f"Working directory exists: {SCRAPER_DIR.exists()}")
            logger.info(f"Config file in scraper dir: {scraper_config_path}")
            logger.info(f"Config file exists BEFORE start: {scraper_config_path.exists()}")
            logger.info(f"Config file absolute path: {scraper_config_path.resolve()}")
            logger.info(f"Python executable: {python_exec}")
            
            # Sprawdź czy plik scrapera istnieje
            scraper_script = SCRAPER_DIR / "scrape_otomoto_simple.py"
            logger.info(f"Scraper script path: {scraper_script}")
            logger.info(f"Scraper script exists: {scraper_script.exists()}")
            
            if not scraper_script.exists():
                error_msg = f"Scraper script not found: {scraper_script}"
                logger.error(f"✗✗✗ {error_msg}")
                raise FileNotFoundError(error_msg)
            
            with _process_lock:
                try:
                    _current_process = subprocess.Popen(
                        cmd,  # -u = unbuffered output
                        cwd=str(SCRAPER_DIR),  # Upewnij się, że to string
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,  # Połącz stderr z stdout
                        text=True,
                        bufsize=0,  # Unbuffered - natychmiastowe wypisywanie
                        universal_newlines=True,
                        encoding='utf-8',  # Jawne kodowanie UTF-8 dla polskich znaków
                        env=env,  # Przekaż zmienne środowiskowe
                        start_new_session=True  # Uruchom w nowej sesji (ważne w Dockerze)
                    )
                except Exception as e:
                    logger.error(f"Failed to start scraper process: {e}")
                    logger.error(f"Command: {' '.join(cmd)}")
                    logger.error(f"Working directory: {SCRAPER_DIR}")
                    logger.error(f"Python executable: {python_exec}")
                    raise
                # Zapisz PID w statusie
                status["process_pid"] = _current_process.pid
                save_status(status)
                log_file.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | [BACKEND] Process started with PID: {_current_process.pid}\n")
                log_file.flush()
                logger.info(f"Process started with PID: {_current_process.pid}")
            
            # Funkcja do czytania logów w czasie rzeczywistym
            def read_logs():
                try:
                    logger.info("[LOG READER] Starting log reader thread")
                    log_file.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | [LOG READER] Starting...\n")
                    log_file.flush()
                    
                    # NIE czekaj - czytaj od razu, żeby nie stracić pierwszych logów!
                    # time.sleep(0.5)  # USUNIĘTE - powodowało tracenie pierwszych logów
                    
                    # Czytaj logi dopóki proces działa
                    # Sprawdzaj czy _current_process nie jest None
                    lines_read = 0
                    while True:
                        with _process_lock:
                            if _current_process is None:
                                logger.info("[LOG READER] Process is None, stopping log reader")
                                log_file.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | [LOG READER] Process is None, stopping\n")
                                log_file.flush()
                                break
                            process = _current_process
                        
                        # Sprawdź czy proces jeszcze działa
                        poll_result = process.poll()
                        if poll_result is not None:
                            # Proces zakończony
                            logger.info(f"[LOG READER] Process finished with return code {poll_result}")
                            log_file.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | [LOG READER] Process finished (return code: {poll_result})\n")
                            log_file.flush()
                            break
                        
                        # Przeczytaj linię (non-blocking)
                        try:
                            # Użyj readline() - powinno być non-blocking jeśli bufsize=1
                            line = process.stdout.readline()
                            if line:
                                line = line.rstrip()
                                if line:
                                    lines_read += 1
                                    # Zapisz do pliku
                                    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                                    log_file.write(f"{timestamp} | {line}\n")
                                    log_file.flush()
                                    # Wyświetl w logach backendu
                                    logger.info(f"[SCRAPER] {line}")
                                    if lines_read == 1:
                                        logger.info(f"[LOG READER] First line read successfully")
                            else:
                                # Brak danych - krótka przerwa
                                time.sleep(0.1)
                        except Exception as read_error:
                            logger.error(f"[LOG READER] Error reading line: {read_error}")
                            time.sleep(0.1)
                    
                    logger.info(f"[LOG READER] Finished reading logs. Total lines: {lines_read}")
                    log_file.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | [LOG READER] Finished. Total lines read: {lines_read}\n")
                    log_file.flush()
                    
                    # Przeczytaj pozostałe logi po zakończeniu procesu (jeśli proces jeszcze istnieje)
                    with _process_lock:
                        process = _current_process
                    
                    if process is not None:
                        try:
                            # Spróbuj przeczytać pozostałe dane
                            import select
                            import sys
                            if sys.platform != 'win32':
                                # Na Linux/Mac można użyć select
                                remaining = process.stdout.read()
                            else:
                                # Na Windows czytaj linia po linii
                                remaining_lines = []
                                while True:
                                    line = process.stdout.readline()
                                    if not line:
                                        break
                                    remaining_lines.append(line)
                                remaining = ''.join(remaining_lines)
                            
                            if remaining:
                                for line in remaining.splitlines():
                                    if line.strip():
                                        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                                        log_file.write(f"{timestamp} | {line}\n")
                                        log_file.flush()
                                        logger.info(f"[SCRAPER] {line}")
                        except Exception as e:
                            logger.debug(f"[LOG READER] Could not read remaining logs: {e}")
                            
                except Exception as e:
                    logger.error(f"[LOG READER] Error reading scraper logs: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    try:
                        log_file.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | [ERROR] Failed to read logs: {e}\n")
                        log_file.flush()
                    except:
                        pass
                finally:
                    try:
                        log_file.close()
                        logger.info("[LOG READER] Log file closed")
                    except:
                        pass
            
            # Uruchom wątek do czytania logów
            log_thread = threading.Thread(target=read_logs, daemon=True)
            log_thread.start()
            
            # Zapisz referencję do procesu na początku (żeby móc pobrać returncode nawet jeśli _current_process zostanie ustawiony na None)
            with _process_lock:
                process_reference = _current_process
            
            if process_reference is None:
                logger.error("Process is None immediately after starting - this should not happen")
                status["status"] = "failed"
                status["error_message"] = "Proces nie został poprawnie uruchomiony"
                status["steps_failed"].append("scraping")
                save_status(status)
                return status
            
            # Czekaj na zakończenie procesu, sprawdzając co chwilę czy nie został anulowany
            cancelled = False
            while process_reference.poll() is None:
                # Sprawdź czy został anulowany
                if is_cancelled():
                    logger.info("Cancellation detected in main loop, terminating scraper process...")
                    cancelled = True
                    try:
                        process_reference.terminate()
                        logger.info("Sent terminate signal to process")
                        try:
                            process_reference.wait(timeout=5)
                            logger.info("Process terminated successfully")
                        except subprocess.TimeoutExpired:
                            logger.warning("Process did not terminate, killing...")
                            process_reference.kill()
                            process_reference.wait()
                            logger.info("Process killed")
                    except Exception as e:
                        logger.error(f"Error terminating process: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                    break
                
                time.sleep(0.5)  # Sprawdzaj co 0.5 sekundy (częściej)
            
            # Poczekaj na zakończenie wątku logowania
            log_thread.join(timeout=5)
            
            # Pobierz wynik
            returncode = process_reference.returncode
            
            # Wyczyść referencję w locku
            with _process_lock:
                _current_process = None
            
            # Jeśli został anulowany, zwróć status cancelled
            if cancelled:
                status["status"] = "cancelled"
                status["error_message"] = "Proces został anulowany przez użytkownika"
                status["completed_at"] = datetime.utcnow().isoformat()
                status["cancelled"] = False  # Reset flagi
                save_status(status)
                return status
            
            if returncode != 0:
                status["status"] = "failed"
                status["current_step"] = "scraping"
                # Pobierz ostatnie linie z pliku logów jako komunikat błędu
                try:
                    with open(SCRAPER_LOG_FILE, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        # Pobierz ostatnie 10 linii jako kontekst błędu
                        error_lines = lines[-10:] if len(lines) > 10 else lines
                        error_msg = "".join(error_lines).strip()[:500]
                        if not error_msg:
                            error_msg = f"Process exited with return code {returncode}"
                except Exception as e:
                    error_msg = f"Process exited with return code {returncode}. Error reading logs: {e}"
                
                status["error_message"] = f"Scraping failed (return code {returncode}): {error_msg}"
                status["steps_failed"].append("scraping")
                save_status(status)
                logger.error(f"Scraping failed with return code {returncode}. Check {SCRAPER_LOG_FILE} for details.")
                return status
            
            # Policz liczbę zescrapowanych ofert z plików w scraped_data/ dla marek z konfiguracji
            # Liczymy tylko te pliki które zostały zmodyfikowane po rozpoczęciu scrapowania
            try:
                scraping_start_timestamp = status.get("scraping_start_timestamp")
                if scraping_start_timestamp:
                    scraping_start_time = datetime.fromtimestamp(scraping_start_timestamp)
                else:
                    # Fallback: użyj started_at
                    scraping_start_time = datetime.fromisoformat(status["started_at"])
                
                # Wczytaj konfigurację aby wiedzieć które marki były scrapowane
                config_file_path = BACKEND_DIR / "scraper_config.json"
                brands_to_scrape = []
                if config_file_path.exists():
                    try:
                        with open(config_file_path, "r", encoding="utf-8") as f:
                            config_data = json.load(f)
                            brands_to_scrape = config_data.get("brands_to_scrape", [])
                            # Zapisz marki do statusu (dla wyświetlania w historii)
                            status["scraped_brands"] = brands_to_scrape
                    except Exception as e:
                        logger.warning(f"Could not load config to count offers: {e}")
                
                scraped_data_dir = SCRAPER_DIR / "scraped_data"
                total_offers = 0
                
                if scraped_data_dir.exists() and brands_to_scrape:
                    # Policz tylko z plików dla marek które były scrapowane
                    for brand in brands_to_scrape:
                        brand_csv = scraped_data_dir / f"{brand.lower()}.csv"
                        if brand_csv.exists():
                            # Sprawdź czy plik został zmodyfikowany po rozpoczęciu scrapowania
                            file_mtime = datetime.fromtimestamp(brand_csv.stat().st_mtime)
                            # Uwzględnij małą tolerancję (1 sekunda) dla różnic w czasie
                            if file_mtime >= scraping_start_time.replace(second=scraping_start_time.second - 1):
                                try:
                                    # Policz wiersze w pliku (bez nagłówka)
                                    with open(brand_csv, "r", encoding="utf-8") as f:
                                        n_lines = sum(1 for _ in f) - 1  # -1 dla nagłówka
                                        total_offers += max(0, n_lines)
                                        logger.info(f"Counted {max(0, n_lines)} offers from {brand_csv.name} (modified: {file_mtime})")
                                except Exception as e:
                                    logger.warning(f"Could not count offers in {brand_csv}: {e}")
                            else:
                                logger.info(f"Skipped {brand_csv.name} - not modified during this scraping (mtime: {file_mtime}, start: {scraping_start_time})")
                    
                    status["n_offers_scraped"] = total_offers
                    logger.info(f"Total scraped offers in this run: {status['n_offers_scraped']} from {len(brands_to_scrape)} brands")
                else:
                    if not scraped_data_dir.exists():
                        logger.warning(f"Scraped data directory not found: {scraped_data_dir}")
                    if not brands_to_scrape:
                        logger.warning("No brands to scrape in config")
                    status["n_offers_scraped"] = None
            except Exception as e:
                logger.warning(f"Could not count scraped offers: {e}")
                import traceback
                logger.warning(traceback.format_exc())
                status["n_offers_scraped"] = None
            
            status["steps_completed"].append("scraping")
            status["progress_percent"] = 70
            save_status(status)
            logger.info(f"Scraping completed. Logs saved to: {SCRAPER_LOG_FILE}")
        
        # Krok 2: Przetwarzanie danych (w tym kopiowanie pliku CSV)
        if "processing" in steps_to_run:
            if start_step == "processing":
                logger.info("=" * 60)
                logger.info("Step 2/5: Processing scraped data (starting from this step)")
                logger.info("=" * 60)
            else:
                logger.info("=" * 60)
                logger.info("Step 2/5: Processing scraped data")
                logger.info("=" * 60)
            
            status["current_step"] = "processing"
            status["progress_percent"] = 75
            save_status(status)
        
            result = subprocess.run(
                [str(scraper_python), "main.py", "--scraped_data", "scraped_data"],
                cwd=SCRAPER_DIR,
                capture_output=True,
                text=True,
                timeout=3600 * 2  # 2h timeout
            )
            
            if result.returncode != 0:
                status["status"] = "failed"
                status["current_step"] = "processing"
                error_msg = result.stderr[:500] if result.stderr else "Unknown error"
                status["error_message"] = f"Processing failed: {error_msg}"
                status["steps_failed"].append("processing")
                save_status(status)
                return status
            
            status["steps_completed"].append("processing")
            status["progress_percent"] = 80
            save_status(status)
            logger.info("Processing completed")
            
            # n_offers_scraped jest już policzone po scrapowaniu (z plików w scraped_data/)
            
            # Kopiowanie pliku CSV jest częścią przetwarzania danych
            logger.info("=" * 60)
            logger.info("Copying CSV file to backend/data/")
            logger.info("=" * 60)
            
            try:
                if not SCRAPER_CSV.exists():
                    raise FileNotFoundError(f"Source CSV not found: {SCRAPER_CSV}")
                
                status["current_step"] = "processing"
                status["progress_percent"] = 82
                save_status(status)
                
                TARGET_CSV.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(SCRAPER_CSV, TARGET_CSV)
                logger.info(f"CSV copied to: {TARGET_CSV}")
                
                status["progress_percent"] = 85
                save_status(status)
            except Exception as e:
                logger.error(f"Error copying CSV file: {e}")
                # Nie kończymy procesu - kopiowanie jest częścią processing, więc jeśli się nie powiedzie,
                # to processing też jest nieudany
                status["error_message"] = f"Processing completed but CSV copy failed: {str(e)}"
                save_status(status)
        
        # Krok 3: Aktualizacja bazy danych
        if "database_update" in steps_to_run:
            if start_step == "database_update":
                logger.info("=" * 60)
                logger.info("Step 3/4: Updating database (starting from this step)")
                logger.info("=" * 60)
            else:
                logger.info("=" * 60)
                logger.info("Step 3/4: Updating database")
                logger.info("=" * 60)
            
            status["current_step"] = "database_update"
            status["progress_percent"] = 90
            save_status(status)
            
            result = subprocess.run(
                [str(backend_python), "init_db.py"],
                cwd=BACKEND_DIR,
                capture_output=True,
                text=True,
                timeout=3600 * 4  # 4h timeout
            )
            
            if result.returncode != 0:
                status["status"] = "failed"
                status["current_step"] = "database_update"
                error_msg = result.stderr[:500] if result.stderr else "Unknown error"
                status["error_message"] = f"Database update failed: {error_msg}"
                status["steps_failed"].append("database_update")
                save_status(status)
                return status
            
            status["steps_completed"].append("database_update")
            status["progress_percent"] = 100  # Zmieniono z 90 na 100 - to ostatni krok
            save_status(status)
        
        # Krok 5: Trenowanie modelu - USUNIĘTY
        # Model jest teraz trenowany na żądanie dla konkretnej marki/modelu podczas wyceny
        # To znacznie przyspiesza aktualizację bazy danych i zmniejsza zużycie zasobów
        
        # Sukces!
        status["status"] = "completed"
        status["current_step"] = None
        status["progress_percent"] = 100
        status["completed_at"] = datetime.utcnow().isoformat()
        save_status(status)
        
        logger.info("=" * 60)
        logger.info("SUCCESS: All steps completed!")
        logger.info("=" * 60)
        
    except subprocess.TimeoutExpired:
        status["status"] = "failed"
        status["error_message"] = "Process timeout - operation took too long"
        status["steps_failed"].append("timeout")
        save_status(status)
        logger.error("Update process timeout")
    except Exception as e:
        status["status"] = "failed"
        status["error_message"] = str(e)[:500]
        status["steps_failed"].append("unknown")
        save_status(status)
        logger.exception("Unexpected error during update")
    
    return status


def bool_from_yes_no(value):
    """Konwertuje 'yes'/'no' na boolean."""
    if isinstance(value, str) and value.strip().lower() == "yes":
        return True
    if isinstance(value, str) and value.strip().lower() == "no":
        return False
    return None


def import_csv_to_database(csv_path: Path) -> Dict:
    """
    Importuje plik CSV do bazy danych.
    
    Args:
        csv_path: Ścieżka do pliku CSV do importu
    
    Returns:
        Dict ze statystykami importu
    """
    # Import lokalny aby uniknąć cyklicznych zależności
    from app.db import SessionLocal
    from app.models import Listing
    
    logger.info(f"Importing CSV from: {csv_path}")
    
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    # Wczytaj CSV
    df = pd.read_csv(csv_path, low_memory=False)
    
    # Mapowanie polskich nazw kolumn na angielskie (jeśli plik ma polskie nagłówki)
    column_mapping = {
        "Stan": "Condition",
        "Marka pojazdu": "Vehicle_brand",
        "Model pojazdu": "Vehicle_model",
        "Wersja": "Vehicle_version",
        "Generacja": "Vehicle_generation",
        "Rok produkcji": "Production_year",
        "Przebieg": "Mileage_km",
        "Moc": "Power_HP",
        "Pojemność skokowa": "Displacement_cm3",
        "Rodzaj paliwa": "Fuel_type",
        "Emisja CO2": "CO2_emissions",
        "Napęd": "Drive",
        "Skrzynia biegów": "Transmission",
        "Typ": "Type",
        "Liczba drzwi": "Doors_number",
        "Kolor": "Colour",
        "Kraj pochodzenia": "Origin_country",
        "Pierwszy właściciel": "First_owner",
        "Pierwsza rejestracja": "First_registration_date",
        "date": "Offer_publication_date",
        "Location": "Offer_location",
    }
    
    # Zmień nazwy kolumn jeśli są polskie
    df = df.rename(columns=column_mapping)
    
    # Wyrzuć rekordy bez ceny
    before = len(df)
    df = df[~pd.isna(df["Price"])].copy()
    after = len(df)
    logger.info(f"Records in CSV: {before}, after removing records without price: {after}")
    
    db: Session = SessionLocal()
    
    # Statystyki
    inserted = 0
    updated = 0
    skipped = 0
    errors = 0
    seen_ids = set()
    
    # Pobierz wszystkie istniejące ID z bazy
    logger.info("Checking existing records in database...")
    existing_ids = {row[0] for row in db.query(Listing.id).all()}
    logger.info(f"Found {len(existing_ids)} existing records in database.")
    
    logger.info("Importing/updating records...")
    for idx, row in df.iterrows():
        try:
            offer_id = int(row["ID"])
            
            # Sprawdź czy to duplikat w samym CSV
            if offer_id in seen_ids:
                logger.warning(f"Duplicate ID {offer_id} in CSV (line {idx + 2}), skipping...")
                skipped += 1
                continue
            seen_ids.add(offer_id)
            
            listing = Listing(
                id=offer_id,
                price_pln=float(row["Price"]),
                currency=str(row["Currency"]),
                condition=str(row["Condition"]) if not pd.isna(row["Condition"]) else None,
                vehicle_brand=str(row["Vehicle_brand"]),
                vehicle_model=str(row["Vehicle_model"]),
                vehicle_version=None if pd.isna(row["Vehicle_version"]) else str(row["Vehicle_version"]),
                vehicle_generation=None if pd.isna(row["Vehicle_generation"]) else str(row["Vehicle_generation"]),
                production_year=int(row["Production_year"]),
                mileage_km=None if pd.isna(row["Mileage_km"]) else float(str(row["Mileage_km"]).replace(" km", "").replace(" ", "").replace(",", ".")),
                power_hp=None if pd.isna(row["Power_HP"]) else float(str(row["Power_HP"]).replace(" KM", "").replace(" ", "").replace(",", ".")),
                displacement_cm3=None if pd.isna(row["Displacement_cm3"]) else float(str(row["Displacement_cm3"]).replace(" cm3", "").replace(" ", "").replace(",", ".")),
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
                        if key != '_sa_instance_state' and key != 'id':
                            setattr(existing, key, value)
                    updated += 1
            else:
                # Dodaj nowy rekord
                db.add(listing)
                existing_ids.add(offer_id)
                inserted += 1
            
            # Commit co 1000 rekordów
            if (inserted + updated) % 1000 == 0:
                db.commit()
                logger.info(f"Processed {inserted + updated} records... (new: {inserted}, updated: {updated})")
                
        except ValueError as e:
            errors += 1
            logger.error(f"Error in line {idx + 2}: Invalid ID value - {e}")
            continue
        except Exception as e:
            errors += 1
            logger.error(f"Error in line {idx + 2}: {e}")
            continue
    
    # Finalny commit
    try:
        db.commit()
        stats = {
            "inserted": inserted,
            "updated": updated,
            "skipped": skipped,
            "errors": errors,
            "total_processed": inserted + updated
        }
        logger.info(f"Import completed! Stats: {stats}")
        return stats
    except Exception as e:
        db.rollback()
        logger.error(f"Error during database commit: {e}")
        raise
    finally:
        db.close()
        # Wymuś zamknięcie wszystkich uchwytów do pliku (ważne w Windows)
        import gc
        gc.collect()

