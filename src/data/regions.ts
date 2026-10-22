// Where a competitor operates (D-145): place names (`US`, `Germany`, `Europe`), free text with a known list so the same
// place gets the same name, and which place lies inside which, so the region filter for Europe also keeps a German
// competitor and one for Germany keeps a Europe-wide or global one. Brought back from the old board for planes (D-233).
export const GLOBAL = 'Global'

// Each place → the bigger places it lies in (every top place lies in Global).
const PARENTS: Record<string, string[]> = {
  Europe: [],
  'North America': [],
  'Latin America': [],
  Asia: [],
  'Middle East': [],
  Africa: [],
  Oceania: [],
  EU: ['Europe'],
  DACH: ['Europe'],
  Nordics: ['Europe'],
  Benelux: ['Europe'],
  'Southeast Asia': ['Asia'],
  US: ['North America'],
  Canada: ['North America'],
  Mexico: ['Latin America', 'North America'],
  Brazil: ['Latin America'],
  Argentina: ['Latin America'],
  Colombia: ['Latin America'],
  Chile: ['Latin America'],
  UK: ['Europe'],
  Ireland: ['Europe', 'EU'],
  Germany: ['DACH', 'EU'],
  Austria: ['DACH', 'EU'],
  Switzerland: ['DACH'],
  France: ['EU'],
  Netherlands: ['Benelux', 'EU'],
  Belgium: ['Benelux', 'EU'],
  Spain: ['EU'],
  Portugal: ['EU'],
  Italy: ['EU'],
  Poland: ['EU'],
  Sweden: ['Nordics', 'EU'],
  Denmark: ['Nordics', 'EU'],
  Finland: ['Nordics', 'EU'],
  Norway: ['Nordics'],
  Turkey: ['Europe', 'Middle East'],
  UAE: ['Middle East'],
  'Saudi Arabia': ['Middle East'],
  Israel: ['Middle East'],
  Egypt: ['Africa', 'Middle East'],
  Nigeria: ['Africa'],
  Kenya: ['Africa'],
  'South Africa': ['Africa'],
  India: ['Asia'],
  China: ['Asia'],
  Japan: ['Asia'],
  'South Korea': ['Asia'],
  Singapore: ['Southeast Asia'],
  Indonesia: ['Southeast Asia'],
  Australia: ['Oceania'],
  'New Zealand': ['Oceania'],
}
// Other ways people write a place → its name in the list.
const ALIASES: Record<string, string> = {
  usa: 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
  'united states': 'US',
  america: 'US',
  amerika: 'US',
  'united kingdom': 'UK',
  britain: 'UK',
  'great britain': 'UK',
  england: 'UK',
  'european union': 'EU',
  deutschland: 'Germany',
  almanya: 'Germany',
  avrupa: 'Europe',
  türkiye: 'Turkey',
  turkiye: 'Turkey',
  'united arab emirates': 'UAE',
  korea: 'South Korea',
  worldwide: GLOBAL,
  international: GLOBAL,
  world: GLOBAL,
  latam: 'Latin America',
  apac: 'Asia',
}

const KNOWN = new Map([GLOBAL, ...Object.keys(PARENTS)].map((p) => [p.toLowerCase(), p]))

// What's typed → the list's name for it when there is one (`usa` → `US`), else the text as written.
export function cleanRegion(s: string): string {
  const t = s.trim().replace(/,/g, '').replace(/\s+/g, ' ').slice(0, 60)
  const low = t.toLowerCase()
  return ALIASES[low] ?? KNOWN.get(low) ?? t
}

// The place and every place it lies in, Global last; a place not in the list lies only in Global.
function within(region: string): Set<string> {
  const out = new Set<string>()
  const walk = (r: string) => {
    if (out.has(r)) return
    out.add(r)
    for (const p of PARENTS[r] ?? []) walk(p)
  }
  walk(cleanRegion(region))
  out.add(GLOBAL)
  return out
}

// One region is inside the other (or the same).
const overlaps = (a: string, b: string) => within(a).has(cleanRegion(b)) || within(b).has(cleanRegion(a))

// Does a competitor operating in `regions` count under the filter? Empty filter = yes; no regions set = no.
export function inRegions(regions: string[] | undefined, filter: string[]): boolean {
  if (filter.length === 0) return true
  return (regions ?? []).some((r) => filter.some((f) => overlaps(r, f)))
}
