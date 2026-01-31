import os
import sys
import time
import random
import json
from typing import List, Dict, Optional
from pathlib import Path
from datetime import datetime

import requests
from bs4 import BeautifulSoup
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed

# Wymuś natychmiastowe wypisywanie (unbuffered)
try:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
except:
    pass  # Może nie działać na wszystkich systemach

# Wypisz informację o starcie na samym początku - TO MUSI BYĆ WIDOCZNE!
print("=" * 60, flush=True)
print("SCRAPER SCRIPT LOADED - START", flush=True)
print("=" * 60, flush=True)
import sys
sys.stdout.flush()
sys.stderr.flush()

# ================== KONFIGURACJA - NAJPIERW ZDEFINIUJ ZMIENNE GLOBALNE ==================

BASE_LISTING_URL = "https://www.otomoto.pl/osobowe/{brand}/?page={page}&search%5Border%5D=created_at_first%3Adesc"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    )
}

# ile marek jednocześnie – docelowo ok. 2 dni przy ~200k ofert
MAX_WORKERS = 2

# Bezpieczne timeouty
REQUEST_TIMEOUT = 10  # Zmniejszone dla szybszego wykrywania problemów

# Opóźnienia – kompromis między czasem a bezpieczeństwem
# Uwaga: Domyślne wartości są ustawiane przez backend w scraper_config.json
DELAY_BETWEEN_OFFERS_MIN = 0.4
DELAY_BETWEEN_OFFERS_MAX = 0.8

DELAY_BETWEEN_PAGES_MIN = 1.0
DELAY_BETWEEN_PAGES_MAX = 2.0

OUTPUT_DIR = "scraped_data"

# Limit ofert do testów (ustaw None dla pełnego scrapowania)
MAX_OFFERS_PER_BRAND = 50  # Pełne scrapowanie - brak limitu

# Marki do scrapowania – wszystkie marki dla pełnego scrapowania
BRANDS_TO_SCRAPE = [
    "abarth",
    "alfa-romeo",
    "audi",
    "bmw",
    "chevrolet",
    "citroen",
    "dacia",
    "fiat",
    "ford",
    "honda",
    "hyundai",
    "kia",
    "mazda",
    "mercedes-benz",
    "nissan",
    "opel",
    "peugeot",
    "renault",
    "seat",
    "skoda",
    "toyota",
    "volkswagen",
    "volvo",
]

# ================== KONFIGURACJA BĘDZIE WCZYTYWANA W main() ==================
# Nie wczytujemy tutaj - zamiast tego wczytamy w main() i użyjemy wartości bezpośrednio

# ================== KONFIGURACJA Z PLIKU (stara funkcja - dla kompatybilności) ==================

def load_config():
    """Wczytuje konfigurację z pliku JSON lub używa domyślnych wartości."""
    # Wypisz na stderr też (może być widoczne wcześniej)
    print(f"[CONFIG] === LOAD_CONFIG STARTED ===", file=sys.stderr, flush=True)
    print(f"[CONFIG] === LOAD_CONFIG STARTED ===", flush=True)
    
    # PRIORYTET 1: Plik w katalogu scrapera (skopiowany przez backend)
    current_file = Path(__file__)
    local_config_file = current_file.parent / "scraper_config.json"
    print(f"[CONFIG] Sprawdzam lokalny plik: {local_config_file}", flush=True)
    print(f"[CONFIG] Lokalny plik istnieje: {local_config_file.exists()}", flush=True)
    print(f"[CONFIG] Lokalny plik istnieje: {local_config_file.exists()}", file=sys.stderr, flush=True)
    
    config_file = None
    if local_config_file.exists():
        config_file = local_config_file
        print(f"[CONFIG] ✓ Używam lokalnego pliku konfiguracji", flush=True)
        print(f"[CONFIG] ✓ Używam lokalnego pliku konfiguracji", file=sys.stderr, flush=True)
    
    # PRIORYTET 2: Zmienna środowiskowa (przekazana z backendu)
    if not config_file or not config_file.exists():
        if "SCRAPER_CONFIG_FILE" in os.environ:
            config_file = Path(os.environ["SCRAPER_CONFIG_FILE"])
            print(f"[CONFIG] Używam ścieżki z zmiennej środowiskowej: {config_file}", flush=True)
            print(f"[CONFIG] Plik istnieje: {config_file.exists()}", flush=True)
    
    # PRIORYTET 3: Standardowe ścieżki
    if not config_file or not config_file.exists():
        print(f"[CONFIG] Szukam w standardowych lokalizacjach...", flush=True)
        
        # Standardowa ścieżka
        config_file = current_file.parent.parent / "AutoTradeAnalytics" / "backend" / "scraper_config.json"
        print(f"[CONFIG] Standardowa ścieżka: {config_file}", flush=True)
        print(f"[CONFIG] Plik istnieje: {config_file.exists()}", flush=True)
        
        # Alternatywna ścieżka
        if not config_file.exists():
            alt_config_file = current_file.parent.parent / "backend" / "scraper_config.json"
            print(f"[CONFIG] Alternatywna ścieżka: {alt_config_file}", flush=True)
            print(f"[CONFIG] Alternatywna istnieje: {alt_config_file.exists()}", flush=True)
            if alt_config_file.exists():
                print(f"[CONFIG] Używam alternatywnej ścieżki", flush=True)
                config_file = alt_config_file
    
    if config_file.exists():
        try:
            print(f"[CONFIG] Otwieram plik: {config_file}", flush=True)
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)
                print(f"[CONFIG] ✓ Wczytano konfigurację z pliku", flush=True)
                print(f"[CONFIG] Zawartość: {json.dumps(config, indent=2)}", flush=True)
                
                # Aktualizuj globalne zmienne
                global MAX_WORKERS, REQUEST_TIMEOUT
                global DELAY_BETWEEN_OFFERS_MIN, DELAY_BETWEEN_OFFERS_MAX
                global DELAY_BETWEEN_PAGES_MIN, DELAY_BETWEEN_PAGES_MAX
                global MAX_OFFERS_PER_BRAND, BRANDS_TO_SCRAPE
                
                old_max_offers = MAX_OFFERS_PER_BRAND
                old_brands = BRANDS_TO_SCRAPE.copy() if isinstance(BRANDS_TO_SCRAPE, list) else BRANDS_TO_SCRAPE
                
                print(f"[CONFIG] PRZED aktualizacją: BRANDS_TO_SCRAPE = {BRANDS_TO_SCRAPE}", flush=True)
                print(f"[CONFIG] PRZED aktualizacją: MAX_OFFERS_PER_BRAND = {MAX_OFFERS_PER_BRAND}", flush=True)
                
                MAX_WORKERS = config.get("max_workers", MAX_WORKERS)
                REQUEST_TIMEOUT = config.get("request_timeout", REQUEST_TIMEOUT)
                DELAY_BETWEEN_OFFERS_MIN = config.get("delay_between_offers_min", DELAY_BETWEEN_OFFERS_MIN)
                DELAY_BETWEEN_OFFERS_MAX = config.get("delay_between_offers_max", DELAY_BETWEEN_OFFERS_MAX)
                DELAY_BETWEEN_PAGES_MIN = config.get("delay_between_pages_min", DELAY_BETWEEN_PAGES_MIN)
                DELAY_BETWEEN_PAGES_MAX = config.get("delay_between_pages_max", DELAY_BETWEEN_PAGES_MAX)
                MAX_OFFERS_PER_BRAND = config.get("max_offers_per_brand", MAX_OFFERS_PER_BRAND)
                BRANDS_TO_SCRAPE = config.get("brands_to_scrape", BRANDS_TO_SCRAPE)
                
                print(f"[CONFIG] ✓ Zaktualizowano zmienne globalne", flush=True)
                print(f"[CONFIG] PO aktualizacji: BRANDS_TO_SCRAPE = {BRANDS_TO_SCRAPE}", flush=True)
                print(f"[CONFIG] PO aktualizacji: MAX_OFFERS_PER_BRAND = {MAX_OFFERS_PER_BRAND}", flush=True)
                print(f"[CONFIG] MAX_OFFERS_PER_BRAND: {old_max_offers} -> {MAX_OFFERS_PER_BRAND}", flush=True)
                print(f"[CONFIG] BRANDS_TO_SCRAPE: {len(old_brands)} -> {len(BRANDS_TO_SCRAPE)} marek", flush=True)
                print(f"[CONFIG] MAX_WORKERS = {MAX_WORKERS}", flush=True)
                
                return config
        except Exception as e:
            print(f"[CONFIG] [ERROR] Błąd wczytywania konfiguracji: {e}", flush=True)
            import traceback
            traceback.print_exc()
            print(f"[CONFIG] Traceback powyżej", flush=True)
    else:
        print(f"[CONFIG] [ERROR] Plik konfiguracji nie istnieje w żadnej lokalizacji!", flush=True)
        print(f"[CONFIG] [ERROR] Szukane ścieżki:", flush=True)
        print(f"[CONFIG] [ERROR]   1. {config_file.resolve() if config_file.parent.exists() else 'NIE ISTNIEJE'}", flush=True)
        print(f"[CONFIG] [ERROR]   2. {alt_config_file.resolve() if alt_config_file.parent.exists() else 'NIE ISTNIEJE'}", flush=True)
    
    print(f"[CONFIG] ⚠ Używam domyślnych wartości (plik nie istnieje lub błąd)", flush=True)
    return None


def parse_date(date_str: str) -> Optional[datetime]:
    """Parsuje datę w formacie DD.MM.YYYY."""
    try:
        return datetime.strptime(date_str, "%d.%m.%Y")
    except:
        return None


def filter_by_date(row: Dict, date_from: Optional[str], date_to: Optional[str]) -> bool:
    """Sprawdza czy oferta mieści się w zakresie dat publikacji."""
    if not date_from and not date_to:
        return True
    
    offer_date_str = row.get("date", "")
    if not offer_date_str:
        # Jeśli brak daty, pomijamy tylko jeśli wymagany jest zakres
        return not (date_from or date_to)
    
    offer_date = parse_date(offer_date_str)
    if not offer_date:
        return not (date_from or date_to)
    
    if date_from:
        from_date = parse_date(date_from)
        if from_date and offer_date < from_date:
            return False
    
    if date_to:
        to_date = parse_date(date_to)
        if to_date and offer_date > to_date:
            return False
    
    return True


# ================== POMOCNICZE ==================


def safe_get(url: str) -> Optional[requests.Response]:
    """Bezpieczny GET z timeoutem i prostym retry."""
    request_start = time.time()
    for attempt in range(3):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            request_time = time.time() - request_start
            if resp.status_code == 200:
                if request_time > 3.0:  # Loguj tylko wolne requesty
                    print(f"[SLOW] Request {url} trwał {request_time:.2f}s")
                return resp
            else:
                print(f"[WARN] {url} -> HTTP {resp.status_code} (próba {attempt+1})")
        except Exception as e:
            print(f"[ERROR] GET {url}, próba {attempt+1}: {e}")
        if attempt < 2:  # Nie czekaj po ostatniej próbie
            time.sleep(1.0 + attempt)
    return None


def parse_polish_date(date_text: str) -> str:
    """
    Wejście np.: '2 grudnia 2025 13:26'
    Wyjście: '02.12.2025'
    """
    month_map = {
        "stycznia": 1,
        "lutego": 2,
        "marca": 3,
        "kwietnia": 4,
        "maja": 5,
        "czerwca": 6,
        "lipca": 7,
        "sierpnia": 8,
        "września": 9,
        "października": 10,
        "listopada": 11,
        "grudnia": 12,
    }

    import re

    m = re.search(r"(\d{1,2})\s+([a-ząćęłńóśżź]+)\s+(\d{4})", date_text.lower())
    if not m:
        # w razie czego zwróć surowy tekst
        return date_text.strip()

    day = int(m.group(1))
    month_word = m.group(2)
    year = int(m.group(3))
    month_num = month_map.get(month_word, 1)

    return f"{day:02d}.{month_num:02d}.{year}"


def extract_value_by_testid(soup: BeautifulSoup, testid: str) -> str:
    """
    Szuka <div data-testid="..."> i zwraca wartość (ostatni <p> wewnątrz).
    """
    div = soup.find("div", {"data-testid": testid})
    if not div:
        return ""
    ps = div.find_all("p")
    if not ps:
        return ""
    return ps[-1].get_text(strip=True)


def is_damaged(soup: BeautifulSoup) -> bool:
    """
    Sprawdza, czy auto jest oznaczone jako uszkodzone.
    data-testid="damaged" -> p == 'Tak'
    """
    damaged_div = soup.find("div", {"data-testid": "damaged"})
    if not damaged_div:
        return False
    text = damaged_div.get_text(" ", strip=True).lower()
    # np. 'Uszkodzony Tak'
    return "tak" in text


def extract_id_from_url(url: str) -> str:
    """
    Wyciąga ID ogłoszenia z URL Otomoto.
    URL ma format: .../osobowe/oferta/[marka]-[model]-[ID].html
    """
    import re
    # Szukamy liczby przed .html na końcu URL
    match = re.search(r'-(\d+)\.html', url)
    if match:
        return match.group(1)
    return ""


def get_offer_urls_from_listing(html: str) -> List[tuple[str, str]]:
    """
    Wyciąga URL-e ofert z listingu wraz z ID.
    Zwraca listę tupli (url, id).
    """
    soup = BeautifulSoup(html, "html.parser")
    urls_with_ids = []

    # Nowy layout: <article data-id="..."> z <a href=".../osobowe/oferta/...">
    articles = soup.find_all("article", attrs={"data-id": True})
    for art in articles:
        # Pobierz ID z atrybutu data-id
        offer_id = art.get("data-id", "")
        
        a_tag = art.find("a", href=True)
        if not a_tag:
            continue
        href = a_tag["href"]
        if "/osobowe/oferta/" in href:
            # Upewnij się, że pełny URL
            if href.startswith("http"):
                full_url = href
            else:
                full_url = "https://www.otomoto.pl" + href
            
            # Jeśli nie mamy ID z data-id, spróbuj wyciągnąć z URL
            if not offer_id:
                offer_id = extract_id_from_url(full_url)
            
            urls_with_ids.append((full_url, offer_id))

    return urls_with_ids


def parse_offer_details(url: str, offer_id: str = "") -> Optional[Dict]:
    """
    Parsuje pojedynczą ofertę:
    - pomija uszkodzone auta
    - wyciąga pola w formacie jak stara baza (PL)
    - przyjmuje offer_id jako parametr (jeśli już znane)
    """
    resp = safe_get(url)
    if resp is None:
        print(f"[ERROR] Nie udało się pobrać oferty: {url}")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # 1) Pomijamy uszkodzone
    if is_damaged(soup):
        print(f"[SKIP] Uszkodzone auto: {url}")
        return None

    row: Dict[str, str] = {}

    # ID ogłoszenia (priorytet: użyj przekazanego ID, potem z URL, potem z HTML)
    if offer_id:
        row["ID"] = offer_id
    else:
        # Spróbuj wyciągnąć z URL
        row["ID"] = extract_id_from_url(url)
        
        # Jeśli nadal puste, spróbuj z HTML
        if not row["ID"]:
            id_text = ""
            id_button = soup.find("button", string=lambda t: t and "ID" in t)
            if id_button:
                id_text = id_button.get_text(" ", strip=True)
            else:
                # fallback – szukamy gdziekolwiek tekstu "ID:"
                import re
                m = re.search(r"ID[:\s]+(\d+)", soup.get_text(" ", strip=True))
                if m:
                    id_text = "ID: " + m.group(1)

            import re
            m = re.search(r"ID[:\s]+(\d+)", id_text)
            if m:
                row["ID"] = m.group(1)
            else:
                row["ID"] = ""

    # Cena
    price_span = soup.find("span", class_="offer-price__number")
    currency_span = soup.find("span", class_="offer-price__currency")
    if price_span:
        try:
            price_str = (
                price_span.get_text(strip=True)
                .replace(" ", "")
                .replace("\xa0", "")
            )
            row["Price"] = int(price_str)
        except Exception:
            row["Price"] = ""
    else:
        row["Price"] = ""

    row["Currency"] = currency_span.get_text(strip=True) if currency_span else "PLN"

    # Data publikacji – na dole strony np. "2 grudnia 2025 13:26"
    pub_date_text = ""
    date_container = soup.find("div", class_="ooa-vtq6wn")
    if date_container:
        p = date_container.find("p")
        if p:
            pub_date_text = p.get_text(strip=True)

    row["date"] = parse_polish_date(pub_date_text) if pub_date_text else ""

    # Lokalizacja – link do #map
    loc_text = ""
    loc_link = soup.find("a", href=lambda h: h and h.endswith("#map"))
    if loc_link:
        loc_p = loc_link.find("p")
        if loc_p:
            loc_text = loc_p.get_text(" ", strip=True)
    row["Location"] = loc_text

    # Szczegóły – dopasowujemy do starych nazw kolumn

    # Podstawowe
    row["Marka pojazdu"] = extract_value_by_testid(soup, "make")
    row["Model pojazdu"] = extract_value_by_testid(soup, "model")
    row["Kolor"] = extract_value_by_testid(soup, "color")
    row["Liczba drzwi"] = extract_value_by_testid(soup, "door_count")
    row["Rok produkcji"] = extract_value_by_testid(soup, "year")

    # Specyfikacja
    row["Rodzaj paliwa"] = extract_value_by_testid(soup, "fuel_type")
    row["Pojemność skokowa"] = extract_value_by_testid(soup, "engine_capacity")
    row["Moc"] = extract_value_by_testid(soup, "engine_power")
    row["Typ"] = extract_value_by_testid(soup, "body_type")
    row["Skrzynia biegów"] = extract_value_by_testid(soup, "gearbox")

    # Stan i historia
    row["Przebieg"] = extract_value_by_testid(soup, "mileage")
    row["Stan"] = extract_value_by_testid(soup, "new_used")

    # Poniższe pola mogą nie zawsze występować w HTML – zostawiamy puste jeśli brak
    row["Emisja CO2"] = extract_value_by_testid(soup, "co2_emission") or ""
    row["Napęd"] = extract_value_by_testid(soup, "drive") or ""
    row["Kraj pochodzenia"] = extract_value_by_testid(soup, "origin_country") or ""
    row["Pierwszy właściciel"] = extract_value_by_testid(soup, "first_owner") or ""
    row["Pierwsza rejestracja"] = (
        extract_value_by_testid(soup, "first_registration") or ""
    )

    # Wersja / generacja – jeśli pojawiają się jako osobne pola
    row["Wersja"] = extract_value_by_testid(soup, "version") or ""
    row["Generacja"] = extract_value_by_testid(soup, "generation") or ""

    # Features – jeśli struktura się zmieniła, trudno, zostawimy []
    features_list = []
    # stary layout: li.offer-features__item
    feats = soup.find_all("li", class_="offer-features__item")
    for li in feats:
        txt = li.get_text(strip=True)
        if txt:
            features_list.append(txt)
    # zapisujemy jako string jak poprzednio, np. "['ABS', 'ASR']"
    row["Features"] = str(features_list)

    # finalny słownik w kolejności starych kluczy (identyczny format jak stary CSV, tylko ID zamiast Index)
    final_keys = [
        "ID",  # Zamiast "Index" - teraz zawiera rzeczywiste ID ogłoszenia
        "Price",
        "Currency",
        "Stan",
        "Marka pojazdu",
        "Model pojazdu",
        "Wersja",
        "Generacja",
        "Rok produkcji",
        "Przebieg",
        "Moc",
        "Pojemność skokowa",
        "Rodzaj paliwa",
        "Emisja CO2",
        "Napęd",
        "Skrzynia biegów",
        "Typ",
        "Liczba drzwi",
        "Kolor",
        "Kraj pochodzenia",
        "Pierwszy właściciel",
        "Pierwsza rejestracja",
        "date",
        "Location",
        "Features",
        # URL nie jest zapisywane - format identyczny ze starym CSV
    ]

    return {k: row.get(k, "") for k in final_keys}


# ================== SCRAPOWANIE MARKI ==================


def scrape_brand(brand: str, date_from: Optional[str] = None, date_to: Optional[str] = None) -> None:
    """
    Scrapuje wszystkie strony dla danej marki.
    Filtruje oferty po dacie publikacji jeśli podano zakres dat.
    Zapisuje wynik do scraped_data/{brand}.csv
    """
    start_time = time.time()
    
    print(f"\n===== SCRAPING BRAND: {brand} =====")
    print(f"[{brand}] MAX_OFFERS_PER_BRAND = {MAX_OFFERS_PER_BRAND}")
    print(f"[{brand}] Opóźnienia: {DELAY_BETWEEN_OFFERS_MIN}-{DELAY_BETWEEN_OFFERS_MAX}s między ofertami, {DELAY_BETWEEN_PAGES_MIN}-{DELAY_BETWEEN_PAGES_MAX}s między stronami")
    
    if date_from or date_to:
        print(f"[{brand}] Filtrowanie: od {date_from or 'początku'} do {date_to or 'końca'}")
    
    all_rows: List[Dict] = []
    page = 1
    max_offers = MAX_OFFERS_PER_BRAND
    filtered_count = 0
    processed_count = 0  # Licznik wszystkich przetworzonych ofert (w tym odrzuconych)
    
    # Dla małych limitów zmniejsz opóźnienia, żeby było szybciej
    delay_offers_min = DELAY_BETWEEN_OFFERS_MIN
    delay_offers_max = DELAY_BETWEEN_OFFERS_MAX
    if max_offers and max_offers <= 50:
        delay_offers_min = max(0.1, DELAY_BETWEEN_OFFERS_MIN * 0.5)
        delay_offers_max = max(0.2, DELAY_BETWEEN_OFFERS_MAX * 0.5)
        print(f"[{brand}] ⚡ Tryb szybki: opóźnienia zmniejszone do {delay_offers_min:.2f}-{delay_offers_max:.2f}s")
    
    print(f"[{brand}] Limit ofert: {max_offers}")

    while True:
        # Sprawdź limit ofert
        if max_offers is not None and len(all_rows) >= max_offers:
            elapsed = time.time() - start_time
            print(f"[{brand}] ✓ Osiągnięto limit {max_offers} ofert w {elapsed:.1f}s, kończę.")
            break

        listing_url = BASE_LISTING_URL.format(brand=brand, page=page)
        print(f"[{brand}] 📄 Strona {page}: {listing_url}")

        resp = safe_get(listing_url)
        if resp is None:
            print(f"[{brand}] Brak odpowiedzi dla strony {page}, kończę markę.")
            break

        offer_urls_with_ids = get_offer_urls_from_listing(resp.text)
        if not offer_urls_with_ids:
            print(f"[{brand}] Brak ofert na stronie {page}, kończę.")
            break

        print(f"[{brand}] Znaleziono {len(offer_urls_with_ids)} ofert na stronie {page}")

        # szczegóły ofert
        for offer_url, offer_id in offer_urls_with_ids:
            # Sprawdź limit PRZED przetwarzaniem - oszczędzamy czas
            if max_offers is not None and len(all_rows) >= max_offers:
                elapsed = time.time() - start_time
                print(f"[{brand}] ✓ Osiągnięto limit {max_offers} ofert w {elapsed:.1f}s, kończę.")
                break

            processed_count += 1
            offer_start = time.time()
            print(f"[{brand}] 🔍 Przetwarzam ofertę {processed_count}: {offer_id or 'bez ID'}")
            details = parse_offer_details(offer_url, offer_id)
            offer_time = time.time() - offer_start
            print(f"[{brand}] ⏱️  Oferta {offer_id or 'bez ID'} przetworzona w {offer_time:.2f}s")
            
            if details is not None:
                # FILTROWANIE PO DATACH
                if filter_by_date(details, date_from, date_to):
                    all_rows.append(details)
                    elapsed = time.time() - start_time
                    print(f"[{brand}] ✓ Pobrano {len(all_rows)}/{max_offers if max_offers else '∞'} ofert (czas: {elapsed:.1f}s)")
                else:
                    filtered_count += 1
                    print(f"[{brand}] ⚠ Pominięto ofertę poza zakresem dat (aktualnie: {len(all_rows)}/{max_offers if max_offers else '∞'}, przetworzono: {processed_count})")
                # Logowanie dla ofert bez ID
                if not offer_id:
                    print(f"[{brand}] ⚠ UWAGA: Pobrano ofertę bez ID: {offer_url}")
            else:
                print(f"[{brand}] ⚠ Nie udało się pobrać szczegółów oferty: {offer_id or offer_url}")

            # opóźnienie między ofertami (użyj zoptymalizowanych wartości dla małych limitów)
            delay = random.uniform(delay_offers_min, delay_offers_max)
            if max_offers and max_offers <= 20:  # Dla bardzo małych limitów loguj opóźnienia
                print(f"[{brand}] ⏸️  Opóźnienie {delay:.2f}s...")
            time.sleep(delay)

        # Jeśli osiągnięto limit, przerwij pętlę stron
        if max_offers is not None and len(all_rows) >= max_offers:
            break

        # kolejna strona
        page += 1

        # opóźnienie między listingami
        time.sleep(
            random.uniform(DELAY_BETWEEN_PAGES_MIN, DELAY_BETWEEN_PAGES_MAX)
        )

    elapsed_total = time.time() - start_time
    
    if filtered_count > 0:
        print(f"[{brand}] ⚠ Pominięto łącznie {filtered_count} ofert poza zakresem dat")
    
    print(f"[{brand}] 📊 Statystyki:")
    print(f"[{brand}]   - Pobrano: {len(all_rows)} ofert")
    print(f"[{brand}]   - Przetworzono: {processed_count} ofert")
    print(f"[{brand}]   - Odrzucono: {filtered_count} ofert")
    print(f"[{brand}]   - Czas: {elapsed_total:.1f}s ({elapsed_total/60:.1f} min)")
    if len(all_rows) > 0:
        print(f"[{brand}]   - Średnio: {elapsed_total/len(all_rows):.2f}s na ofertę")
    
    # zapis CSV dla marki
    if all_rows:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        df = pd.DataFrame(all_rows)
        out_path = os.path.join(OUTPUT_DIR, f"{brand}.csv")
        df.to_csv(out_path, index=False)
        print(f"[{brand}] Saved {len(all_rows)} rows to {out_path}")
        # Sprawdź ile ofert ma ID
        ids_count = df["ID"].astype(str).str.strip().ne("").sum()
        print(f"[{brand}] Ofert z ID: {ids_count}/{len(all_rows)}")
    else:
        print(f"[{brand}] Brak danych do zapisania.")


# ================== GŁÓWNA FUNKCJA ==================


def main():
    # Deklaracja zmiennych globalnych na początku funkcji
    global MAX_OFFERS_PER_BRAND
    
    # PROSTE ROZWIĄZANIE: WCZYTAJ KONFIGURACJĘ Z PLIKU NA SAMYM POCZĄTKU
    print("=" * 60, flush=True)
    print("[MAIN] === START ===", flush=True)
    print("=" * 60, flush=True)
    
    # WCZYTAJ KONFIGURACJĘ - PROSTE PODEJŚCIE
    config = None
    
    # Sprawdź różne możliwe lokalizacje pliku
    current_dir = Path(__file__).parent
    current_file_abs = Path(__file__).resolve()
    current_dir_abs = current_file_abs.parent
    
    print(f"[MAIN] __file__ = {__file__}", flush=True)
    print(f"[MAIN] current_dir (relative) = {current_dir}", flush=True)
    print(f"[MAIN] current_dir_abs (absolute) = {current_dir_abs}", flush=True)
    print(f"[MAIN] os.getcwd() = {os.getcwd()}", flush=True)
    
    # Spróbuj różne ścieżki
    possible_paths = [
        current_dir_abs / "scraper_config.json",  # Najpewniejsze - obok scrape_otomoto.py
        current_dir / "scraper_config.json",      # Względna ścieżka
        Path(os.getcwd()) / "scraper_config.json",  # Bieżący katalog roboczy
    ]
    
    # Jeśli jest zmienna środowiskowa, dodaj ją też
    if "SCRAPER_CONFIG_FILE" in os.environ:
        possible_paths.insert(0, Path(os.environ["SCRAPER_CONFIG_FILE"]))
    
    config_file = None
    for path in possible_paths:
        print(f"[MAIN] Sprawdzam: {path}", flush=True)
        print(f"[MAIN]   - exists: {path.exists()}", flush=True)
        if path.exists():
            config_file = path
            print(f"[MAIN] ✓ Znaleziono plik: {config_file}", flush=True)
            break
    
    if not config_file:
        print(f"[MAIN] ✗ Nie znaleziono pliku konfiguracji w żadnej lokalizacji!", flush=True)
        print(f"[MAIN] Sprawdzane ścieżki:", flush=True)
        for path in possible_paths:
            print(f"[MAIN]   - {path} (exists: {path.exists()})", flush=True)
    
    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                config = json.load(f)
            print(f"[MAIN] ✓✓✓ WCZYTANO KONFIGURACJĘ Z PLIKU!", flush=True)
            print(f"[MAIN] ✓✓✓ brands={config.get('brands_to_scrape')}", flush=True)
            print(f"[MAIN] ✓✓✓ max_offers={config.get('max_offers_per_brand')}", flush=True)
        except Exception as e:
            print(f"[MAIN] [ERROR] Błąd wczytywania pliku: {e}", flush=True)
            import traceback
            traceback.print_exc()
    
    # Jeśli nie ma lokalnego pliku, sprawdź zmienną środowiskową
    if not config and "SCRAPER_CONFIG_FILE" in os.environ:
        config_file_env = Path(os.environ["SCRAPER_CONFIG_FILE"])
        print(f"[MAIN] Sprawdzam SCRAPER_CONFIG_FILE: {config_file_env}", flush=True)
        if config_file_env.exists():
            try:
                with open(config_file_env, "r", encoding="utf-8") as f:
                    config = json.load(f)
                print(f"[MAIN] ✓✓✓ WCZYTANO KONFIGURACJĘ Z SCRAPER_CONFIG_FILE!", flush=True)
                print(f"[MAIN] ✓✓✓ brands={config.get('brands_to_scrape')}", flush=True)
                print(f"[MAIN] ✓✓✓ max_offers={config.get('max_offers_per_brand')}", flush=True)
            except Exception as e:
                print(f"[MAIN] [ERROR] Błąd wczytywania: {e}", flush=True)
    
    # Jeśli nadal brak, użyj load_config() jako fallback
    if not config:
        print(f"[MAIN] Brak konfiguracji w pliku, używam load_config()...", flush=True)
        config = load_config()
    
    try:
        print("=" * 60, flush=True)
        print("SCRAPER STARTED - main() function called", flush=True)
        print("=" * 60, flush=True)
        
        # Konfiguracja została już wczytana na początku funkcji
        print(f"[MAIN] Konfiguracja wczytana: {config is not None}", flush=True)
        if config:
            print(f"[MAIN] Zawartość konfiguracji: brands={config.get('brands_to_scrape')}, max_offers={config.get('max_offers_per_brand')}", flush=True)
        else:
            print(f"[MAIN] [ERROR] BRAK KONFIGURACJI! Używam domyślnych wartości", flush=True)
            print(f"[MAIN] Domyślne BRANDS_TO_SCRAPE = {BRANDS_TO_SCRAPE}", flush=True)
            print(f"[MAIN] Domyślne MAX_OFFERS_PER_BRAND = {MAX_OFFERS_PER_BRAND}", flush=True)
        
        # WYMUSZENIE - wypisz informacje o konfiguracji NAJPIERW, żeby były widoczne
        print("=" * 60, flush=True)
        print("[MAIN] === KONFIGURACJA ===", flush=True)
        print(f"[MAIN] config is None: {config is None}", flush=True)
        if config:
            print(f"[MAIN] config.get('brands_to_scrape'): {config.get('brands_to_scrape')}", flush=True)
            print(f"[MAIN] config.get('max_offers_per_brand'): {config.get('max_offers_per_brand')}", flush=True)
        print("=" * 60, flush=True)
        
        # UŻYJ KONFIGURACJI BEZPOŚREDNIO zamiast zmiennych globalnych!
        # WYMUSZ UŻYCIE KONFIGURACJI - jeśli config jest None, to błąd!
        if not config:
            print(f"[MAIN] [FATAL ERROR] ⚠ BRAK KONFIGURACJI! To nie powinno się zdarzyć!", flush=True)
            print(f"[MAIN] [FATAL ERROR] Sprawdzam zmienną środowiskową SCRAPER_CONFIG_FILE...", flush=True)
            if "SCRAPER_CONFIG_FILE" in os.environ:
                config_path = Path(os.environ["SCRAPER_CONFIG_FILE"])
                print(f"[MAIN] [FATAL ERROR] SCRAPER_CONFIG_FILE = {config_path}", flush=True)
                print(f"[MAIN] [FATAL ERROR] Plik istnieje: {config_path.exists()}", flush=True)
                if config_path.exists():
                    try:
                        with open(config_path, "r", encoding="utf-8") as f:
                            config = json.load(f)
                            print(f"[MAIN] [FATAL ERROR] ✓ Wczytano konfigurację w trybie awaryjnym!", flush=True)
                    except Exception as e:
                        print(f"[MAIN] [FATAL ERROR] Błąd wczytywania: {e}", flush=True)
            else:
                print(f"[MAIN] [FATAL ERROR] Brak zmiennej środowiskowej SCRAPER_CONFIG_FILE!", flush=True)
        
        # Jeśli nadal brak konfiguracji, użyj domyślnych (ale to błąd!)
        if not config:
            print(f"[MAIN] [FATAL ERROR] ⚠ Używam domyślnych wartości (TO JEST BŁĄD!)", flush=True)
            brands = BRANDS_TO_SCRAPE
            max_offers = MAX_OFFERS_PER_BRAND
            date_from = None
            date_to = None
            max_workers = MAX_WORKERS
        else:
            # Użyj konfiguracji - WYMUSZENIE!
            brands_raw = config.get("brands_to_scrape")
            max_offers_raw = config.get("max_offers_per_brand")
            
            print(f"[MAIN] [DEBUG] brands_raw z config.get(): {brands_raw}", flush=True)
            print(f"[MAIN] [DEBUG] brands_raw type: {type(brands_raw)}", flush=True)
            print(f"[MAIN] [DEBUG] brands_raw is None: {brands_raw is None}", flush=True)
            print(f"[MAIN] [DEBUG] bool(brands_raw): {bool(brands_raw)}", flush=True)
            
            # Użyj wartości z konfiguracji BEZPOŚREDNIO - nie używaj domyślnych!
            if brands_raw is not None and brands_raw:  # Jeśli jest wartość, użyj jej
                brands = brands_raw
                print(f"[MAIN] ✓ Używam brands z konfiguracji: {brands}", flush=True)
            else:
                print(f"[MAIN] [ERROR] brands_to_scrape jest None lub puste! Wartość: {brands_raw}", flush=True)
                brands = BRANDS_TO_SCRAPE  # Fallback tylko jeśli naprawdę brak
            
            if max_offers_raw is not None:
                max_offers = max_offers_raw
                print(f"[MAIN] ✓ Używam max_offers z konfiguracji: {max_offers}", flush=True)
            else:
                print(f"[MAIN] [ERROR] max_offers_per_brand jest None! Wartość: {max_offers_raw}", flush=True)
                max_offers = MAX_OFFERS_PER_BRAND  # Fallback tylko jeśli naprawdę brak
            
            date_from = config.get("date_from")
            date_to = config.get("date_to")
            max_workers = config.get("max_workers", MAX_WORKERS)
            
            print(f"[MAIN] ✓✓✓ FINALNE WARTOŚCI:", flush=True)
            print(f"[MAIN] ✓✓✓ brands = {brands}", flush=True)
            print(f"[MAIN] ✓✓✓ max_offers = {max_offers}", flush=True)
        
        print(f"[MAIN] PO load_config(): BRANDS_TO_SCRAPE = {BRANDS_TO_SCRAPE}", flush=True)
        print(f"[MAIN] PO load_config(): MAX_OFFERS_PER_BRAND = {MAX_OFFERS_PER_BRAND}", flush=True)
        print(f"[MAIN] Używam brands = {brands}", flush=True)
        print(f"[MAIN] Używam max_offers = {max_offers}", flush=True)
        
        # WYMUSZENIE - jeśli brands to wszystkie marki, to znaczy że konfiguracja nie działa!
        # W takim przypadku, spróbuj wczytać konfigurację jeszcze raz i wymuś użycie!
        if brands == BRANDS_TO_SCRAPE or len(brands) > 5:  # Jeśli więcej niż 5 marek, to prawdopodobnie domyślne
            print(f"[MAIN] [FATAL] ⚠⚠⚠ Używam domyślnych marek zamiast konfiguracji!", flush=True)
            print(f"[MAIN] [FATAL] brands = {brands}", flush=True)
            print(f"[MAIN] [FATAL] config = {config}", flush=True)
            
            # Spróbuj wczytać konfigurację jeszcze raz BEZPOŚREDNIO
            local_config = Path(__file__).parent / "scraper_config.json"
            print(f"[MAIN] [FATAL] Próbuję wczytać konfigurację jeszcze raz z {local_config}", flush=True)
            if local_config.exists():
                try:
                    with open(local_config, "r", encoding="utf-8") as f:
                        config_retry = json.load(f)
                        brands_retry = config_retry.get("brands_to_scrape")
                        max_offers_retry = config_retry.get("max_offers_per_brand")
                        if brands_retry:
                            print(f"[MAIN] [FATAL] ✓✓✓ WYMUSZAM użycie konfiguracji: brands={brands_retry}, max_offers={max_offers_retry}", flush=True)
                            brands = brands_retry
                            max_offers = max_offers_retry
                            # Zaktualizuj też zmienną globalną dla scrape_brand
                            old_max_offers = MAX_OFFERS_PER_BRAND
                            MAX_OFFERS_PER_BRAND = max_offers_retry
                            print(f"[MAIN] [FATAL] Zaktualizowano MAX_OFFERS_PER_BRAND: {old_max_offers} -> {MAX_OFFERS_PER_BRAND}", flush=True)
                except Exception as e:
                    print(f"[MAIN] [FATAL] Błąd wczytywania konfiguracji: {e}", flush=True)
        
        print("[MAIN] Collecting webscrap list (brands)...", flush=True)
        print(f"[MAIN] Brands to scrape: {', '.join(brands)}", flush=True)
        print(f"[MAIN] [DEBUG] brands type: {type(brands)}, value: {brands}", flush=True)
        print(f"[MAIN] [DEBUG] brands == BRANDS_TO_SCRAPE: {brands == BRANDS_TO_SCRAPE}", flush=True)
        print(f"[MAIN] Saving CSV files to: {OUTPUT_DIR}", flush=True)
        if max_offers:
            print(f"[MAIN] TEST MODE: Limit {max_offers} ofert na markę", flush=True)
        else:
            print("[MAIN] FULL MODE: Brak limitu ofert", flush=True)
        
        if date_from or date_to:
            print(f"[MAIN] Date filter: {date_from or 'początek'} - {date_to or 'koniec'}", flush=True)

        print(f"[MAIN] Uruchamiam scrapowanie dla {len(brands)} marek...", flush=True)
        print(f"[MAIN] Max workers: {max_workers}", flush=True)
        
        # Tymczasowo zaktualizuj zmienne globalne dla funkcji scrape_brand
        old_max_offers = MAX_OFFERS_PER_BRAND
        MAX_OFFERS_PER_BRAND = max_offers
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(scrape_brand, b, date_from, date_to): b for b in brands}
            for future in as_completed(futures):
                brand = futures[future]
                try:
                    future.result()
                    print(f"[MAIN] ✓ Marka {brand} zakończona", flush=True)
                except Exception as e:
                    print(f"[MAIN] [ERROR] Brand {brand} zakończył się wyjątkiem: {e}", flush=True)
                    import traceback
                    traceback.print_exc(file=sys.stderr)
                    print(f"[MAIN] [ERROR] Traceback dla {brand}:", flush=True)
                    traceback.print_exc()
                    # Nie kończ całego procesu - kontynuuj z innymi markami
        
        # Przywróć oryginalną wartość
        MAX_OFFERS_PER_BRAND = old_max_offers
        
        print("[MAIN] Scrapowanie zakończone!", flush=True)
        # Sprawdź czy były jakieś błędy
        print("[MAIN] Sprawdzam czy wszystkie marki zostały przetworzone...", flush=True)
    except KeyboardInterrupt:
        print("[MAIN] Przerwano przez użytkownika (Ctrl+C)", flush=True)
        sys.exit(130)  # Standard exit code for SIGINT
    except Exception as e:
        print(f"[MAIN] FATAL ERROR: {e}", flush=True)
        print(f"[MAIN] FATAL ERROR: {e}", flush=True, file=sys.stderr)
        import traceback
        print("[MAIN] Traceback:", flush=True)
        traceback.print_exc()
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


# === WRAPPER DLA STAREGO main.py ===


def scrape_otomoto():
    """
    Wrapper dla kompatybilności ze starym main.py –
    po prostu uruchamia pełne scrapowanie.
    """
    main()


if __name__ == "__main__":
    main()
