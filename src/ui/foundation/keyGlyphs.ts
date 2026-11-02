// Keys as this computer writes them (D-355). The app writes a shortcut the Mac way (`⌘F`, `⇧⌘Z`, `⌥ drag`); on a Mac
// that is what's shown, anywhere else the same shortcut in words (`Ctrl+F`, `Ctrl+Shift+Z`, `Alt drag`), since ⌘ and ⌥
// mean nothing on Windows or Linux. The handlers already take Ctrl for ⌘ (`metaKey || ctrlKey`).

type NavigatorWithData = Navigator & { userAgentData?: { platform?: string } }

export function isMacLike(nav: NavigatorWithData | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  if (!nav) return true
  const p = nav.userAgentData?.platform || nav.platform || nav.userAgent || ''
  return /mac|iphone|ipad|ipod/i.test(p)
}

const IS_MAC = isMacLike()

// The modifiers in the order other systems write them, and their names there.
const MODS: readonly [glyph: string, name: string][] = [
  ['⌃', 'Ctrl'],
  ['⌘', 'Ctrl'],
  ['⌥', 'Alt'],
  ['⇧', 'Shift'],
]
// Keys whose Mac glyph reads as nothing elsewhere.
const KEYS: Record<string, string> = { '⌫': 'Backspace', '⇥': 'Tab' }

// `⇧⌘Z  ⌃Y` → `Ctrl+Shift+Z  Ctrl+Y`; `⌥ drag` → `Alt drag`; `⌥1–⌥9` → `Alt+1–Alt+9`. A Mac gets the string as it is.
export function keyGlyphs(s: string, mac = IS_MAC): string {
  if (mac) return s
  return s
    .replace(/([⌃⌘⌥⇧]+)([^\s⌃⌘⌥⇧–,·:;()]?)/g, (_, mods: string, key: string) => {
      const names = [...new Set(MODS.filter(([g]) => mods.includes(g)).map(([, n]) => n))]
      const k = KEYS[key] ?? key
      return k ? [...names, k.length === 1 ? k.toUpperCase() : k].join('+') : names.join('+')
    })
    .replace(/[⌫⇥]/g, (g) => KEYS[g])
}
