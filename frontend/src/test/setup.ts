import '@testing-library/jest-dom'
import { afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'

// Mock localStorage (jsdom może nie udostępniać go poprawnie w testach)
const storage: Record<string, string> = {}
beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value },
      removeItem: (key: string) => { delete storage[key] },
      clear: () => { for (const k of Object.keys(storage)) delete storage[k] },
      key: (i: number) => Object.keys(storage)[i] ?? null,
      get length() { return Object.keys(storage).length },
    },
    writable: true,
  })
})

// Cleanup after each test
afterEach(() => {
  cleanup()
  for (const k of Object.keys(storage)) delete storage[k]
})

