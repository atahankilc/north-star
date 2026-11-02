// A priority as a pill (D-256, D-271, D-358): P1 magenta, P2 the ink, P3 the chip's own grey. One look wherever a task
// or card shows its priority; on a card's tinted face P1 leans to the ink (`--clash-ink`, set by CardFace, D-295).
import { Chip } from '../../../ui/primitives/Chip'

export const PRIORITY_TONE: Record<string, string | undefined> = { P1: 'var(--clash-ink, var(--accent-magenta))', P2: 'var(--fg)' }

// `tone`: another colour than its own (the suggested order's `P2 → P1`, yellow).
export function PriorityChip({ priority, tone, children }: { priority: string; tone?: string; children?: string }) {
  return (
    <Chip variant="pill" tone={tone ?? PRIORITY_TONE[priority]}>
      {children ?? priority}
    </Chip>
  )
}
