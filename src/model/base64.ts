// Bytes as text and back (btoa's alphabet): carets in presence (D-374) and writing together's packets in RTDB (D-426),
// which keeps no bytes.
export function toBase64(u: Uint8Array) {
  let s = ''
  // In slices, so a big state never spreads more arguments than a call takes.
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(s: string) {
  const bin = atob(s)
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return u
}

// How long n bytes are as base64: the RTDB rules' caps (database.rules.json) are these lengths.
export const base64Length = (n: number) => 4 * Math.ceil(n / 3)
