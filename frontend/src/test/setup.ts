import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const localStore = new Map<string, string>()
const testStorage: Storage = {
  get length() { return localStore.size },
  clear: () => localStore.clear(),
  getItem: (key) => localStore.get(key) ?? null,
  key: (index) => [...localStore.keys()][index] ?? null,
  removeItem: (key) => { localStore.delete(key) },
  setItem: (key, value) => { localStore.set(key, String(value)) },
}

Object.defineProperty(window, 'localStorage', { configurable: true, value: testStorage })

afterEach(() => {
  cleanup()
  testStorage.clear()
})
