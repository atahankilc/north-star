// How long ago, short: `now`, `5m`, `3h`, `2d`, `4w`, then the date (sticky notes, threads).
export function ago(t: number, now = Date.now()): string {
  const s = Math.max(0, (now - t) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`
  if (s < 86400 * 7 * 8) return `${Math.floor(s / (86400 * 7))}w`
  return new Date(t).toISOString().slice(0, 10)
}
