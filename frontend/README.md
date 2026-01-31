# Frontend - React + TypeScript + Vite

Standardowy setup React z Vite. Używam TypeScript dla lepszego typowania.

## Uruchomienie

```powershell
npm install
npm run dev
```

Aplikacja działa na http://localhost:5173 (domyślnie).

## Build

```powershell
npm run build
```

Pliki produkcyjne w katalogu `dist/`.

## Linting

```powershell
npm run lint
```

## Struktura

- `src/components/` - komponenty React
- `src/context/` - Context API (autentykacja)
- `src/types/` - definicje TypeScript
- `src/config/` - konfiguracja (API URL itp.)
- `src/utils/` - funkcje pomocnicze

## API

Backend powinien działać na http://127.0.0.1:8000. URL można zmienić w `src/config/api.ts`.

## Uwagi

- Używam Chart.js do wykresów
- Axios do komunikacji z API
- React 19 (najnowsza wersja)
- Vite jako bundler (szybki HMR)
