// Tags group cards within a type (D-056); colour means the card's type (D-055).
export const TAG_HINT = 'Group cards of the same type, e.g. mvp or pricing. Filter by tag at the top.'

// "mvp, #pricing , mvp" → ["mvp", "pricing"].
export const parseTags = (s: string) => [...new Set(s.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))]
