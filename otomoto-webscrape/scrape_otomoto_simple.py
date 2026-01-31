#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PROSTY SCRAPER Z WCZYTYWANIEM KONFIGURACJI
Ten skrypt NA PEWNO wczyta konfigurację z pliku.
"""
import os
import sys
import json
from pathlib import Path

# WYMUŚ UTF-8 dla stdout/stderr (ważne dla Windows)
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# WYMUŚ UNBUFFERED OUTPUT
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(line_buffering=True)

print("=" * 60, flush=True)
print("SIMPLE SCRAPER STARTED", flush=True)
print("=" * 60, flush=True)

# WCZYTAJ KONFIGURACJĘ
config_file = Path(__file__).parent / "scraper_config.json"
print(f"[CONFIG] Plik konfiguracji: {config_file}", flush=True)
print(f"[CONFIG] Plik istnieje: {config_file.exists()}", flush=True)
print(f"[CONFIG] Current dir: {os.getcwd()}", flush=True)
print(f"[CONFIG] Script dir: {Path(__file__).parent}", flush=True)

if config_file.exists():
    with open(config_file, "r", encoding="utf-8") as f:
        config = json.load(f)
    print(f"[CONFIG] OK WCZYTANO KONFIGURACJE!", flush=True)
    print(f"[CONFIG] brands_to_scrape: {config.get('brands_to_scrape')}", flush=True)
    print(f"[CONFIG] max_offers_per_brand: {config.get('max_offers_per_brand')}", flush=True)
    
    # PRZEKAŻ KONFIGURACJĘ DO WŁAŚCIWEGO SCRAPERA
    # Zmodyfikuj zmienne globalne w scrape_otomoto PRZED importem
    os.environ['SCRAPER_BRANDS'] = json.dumps(config.get('brands_to_scrape', []))
    os.environ['SCRAPER_MAX_OFFERS'] = str(config.get('max_offers_per_brand', 50))
    os.environ['SCRAPER_MAX_WORKERS'] = str(config.get('max_workers', 2))
    os.environ['SCRAPER_DATE_FROM'] = str(config.get('date_from', ''))
    os.environ['SCRAPER_DATE_TO'] = str(config.get('date_to', ''))
else:
    print(f"[CONFIG] BLAD - PLIK NIE ISTNIEJE!", flush=True)
    print(f"[CONFIG] Uzywam domyslnych wartosci", flush=True)

# TERAZ ZAIMPORTUJ I URUCHOM WŁAŚCIWY SCRAPER
print("[CONFIG] Importuję główny moduł scrapera...", flush=True)

# Import głównego modułu
import scrape_otomoto

# Zastosuj konfigurację
if config_file.exists():
    scrape_otomoto.BRANDS_TO_SCRAPE = config.get('brands_to_scrape', scrape_otomoto.BRANDS_TO_SCRAPE)
    scrape_otomoto.MAX_OFFERS_PER_BRAND = config.get('max_offers_per_brand', scrape_otomoto.MAX_OFFERS_PER_BRAND)
    scrape_otomoto.MAX_WORKERS = config.get('max_workers', scrape_otomoto.MAX_WORKERS)
    
    print(f"[CONFIG] OK Zastosowano konfiguracje do modulu", flush=True)
    print(f"[CONFIG] BRANDS_TO_SCRAPE = {scrape_otomoto.BRANDS_TO_SCRAPE}", flush=True)
    print(f"[CONFIG] MAX_OFFERS_PER_BRAND = {scrape_otomoto.MAX_OFFERS_PER_BRAND}", flush=True)

# URUCHOM SCRAPER
print("[CONFIG] Uruchamiam scraper...", flush=True)
print("=" * 60, flush=True)

# Wywołaj main() z właściwą konfiguracją
scrape_otomoto.main()

