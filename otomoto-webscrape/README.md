# Otomoto webscrape

Scraper do pobierania ofert z otomoto.pl.

Używany do zbierania danych dla datasetu na Kaggle. Uwaga - pełne scrapowanie może trwać kilka godzin, w zależności od liczby marek i limitu ofert.

## Użycie

```bash
python main.py [options]
```

**Opcje:**
- `--scraped_data` - folder z już zeskrapowanymi danymi (jeśli już uruchamiałeś scraper, default: None)
- `--save_file` - zapisz plik z polskimi nazwami (default: True)
- `--translate` - przetłumacz na angielski i zapisz (default: True)

## Przykład

```bash
python main.py
```

Scraper zapisze dane do folderu `scraped_data/` w formacie CSV (jeden plik na markę).

## Uwagi

- Scrapowanie może zająć dużo czasu
- Używaj limitów ofert na markę, żeby nie czekać zbyt długo
- Dane są zapisywane w CSV - można je potem zaimportować do bazy przez panel admina
