// This browser's own settings (D-361): read from and kept in localStorage, never throwing. Storage can refuse any
// access (a private window, Safari blocking site data, no window in node): then nothing is read (`null`, the default
// applies) and nothing kept (the setting lasts this tab).
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// A JSON value as kept; `fallback` when there's none or it doesn't parse.
export function readLocalJson<T>(key: string, fallback: T): T {
  const raw = readLocal(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// `null` takes it away (back to the default).
export function keepLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Not kept: it applies for this tab only.
  }
}
