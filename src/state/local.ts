// This browser's own settings (D-361): read from and kept in localStorage, never throwing. Storage can refuse any
// access (a private window, Safari blocking site data, no window in node): then nothing is read (`null`, the default
// applies) and nothing kept (the setting lasts this tab). What lasts only while the tab is open (a dev switch, the
// reload guard) is the same through sessionStorage: `readSession`, `keepSession`.
type Area = 'localStorage' | 'sessionStorage'

function read(area: Area, key: string): string | null {
  try {
    return globalThis[area].getItem(key)
  } catch {
    return null
  }
}

// `null` takes it away. Says whether it was kept (false: storage refused it).
function keep(area: Area, key: string, value: string | null): boolean {
  try {
    if (value === null) globalThis[area].removeItem(key)
    else globalThis[area].setItem(key, value)
    return true
  } catch {
    return false
  }
}

export const readLocal = (key: string) => read('localStorage', key)
export const readSession = (key: string) => read('sessionStorage', key)

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

// `null` takes it away (back to the default). Not kept, it applies for this tab only.
export const keepLocal = (key: string, value: string | null) => keep('localStorage', key, value)
export const keepSession = (key: string, value: string | null) => keep('sessionStorage', key, value)

// Everything kept under names starting with `prefix`, taken away (a setting no longer kept in the browser).
export function forgetLocal(prefix: string) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k)
  } catch {
    // Nothing kept, nothing to take away.
  }
}
