// A card named in a message (D-436): `#` and a card's name, picked, goes into the message as `[[id|name]]`: plain text,
// so the rules and every copy of it stay as they are, with the card's id to go to and the name it had to fall back on.
// Shown, it's the card's badge and its name now (or the old name, struck, when the card is gone); read anywhere as text
// (a conversation's preview, its find), the name alone.
export const CARD_REF = /\[\[([A-Za-z0-9_-]{1,40})\|([^\]\n]{0,200})\]\]/g

// The text with each card named as its name (`plain`); a preview cut inside one ends with `…`.
export const cardRefsAsText = (text: string) => text.replace(CARD_REF, (_, _id, name: string) => name).replace(/\[\[[^\]]*$/, '…')

// Picked while typing: `#Name` in the field for each card picked (id → name); as it's sent, each becomes its reference.
// The longest names first, so one that starts another's isn't taken for it.
export function withCardRefs(text: string, picked: Map<string, string>) {
  let out = text
  for (const [id, name] of [...picked].sort((a, b) => b[1].length - a[1].length)) out = out.split(`#${name}`).join(`[[${id}|${name}]]`)
  return out
}

// A message being edited: its references back as `#Name`, and which cards they are.
export function cardRefsForEditing(text: string): { text: string; picked: Map<string, string> } {
  const picked = new Map<string, string>()
  const out = text.replace(CARD_REF, (_, id: string, name: string) => (picked.set(id, name), `#${name}`))
  return { text: out, picked }
}
