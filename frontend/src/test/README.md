# Testy Frontendu

## Uruchomienie testów

```bash
# Wszystkie testy
npm run test

# Testy w trybie watch
npm run test -- --watch

# Testy z UI
npm run test:ui

# Testy z coverage
npm run test:coverage
```

## Struktura testów

- `*.test.ts` - testy funkcji pomocniczych
- `*.test.tsx` - testy komponentów React

## Używane biblioteki

- **Vitest** - framework testowy
- **React Testing Library** - testowanie komponentów React
- **jsdom** - środowisko DOM dla testów

