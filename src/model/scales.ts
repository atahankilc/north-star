// A matrix's or a table's scales to start from (D-204, D-209), and the short ids their steps and entries get. Nothing
// here imports anything at run time: matrix.ts, pieces.ts and table.ts import each other, and table.ts reads a scale as
// it loads, whichever of them loads first (the workspace's code is its own chunk, so that order changes).
import type { Step, Tone } from './matrix'

export const newId = () => Math.random().toString(36).slice(2, 8)

const step = (glyph: string, label: string, tone: Tone): Step => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), glyph, label, tone })

// Scales to start from; every step can be renamed, recoloured, added or taken out after.
export const SCALES: { key: string; name: string; steps: Step[] }[] = [
  { key: 'coverage', name: 'coverage', steps: [step('○', 'none', 'dim'), step('◐', 'partial', 'yellow'), step('●', 'full', 'cyan'), step('★', 'better', 'magenta')] },
  { key: 'yes-no', name: 'yes / no', steps: [step('✕', 'no', 'dim'), step('✓', 'yes', 'green')] },
  { key: 'level', name: 'low → high', steps: [step('▁', 'low', 'dim'), step('▄', 'medium', 'yellow'), step('█', 'high', 'magenta')] },
  {
    key: 'five',
    name: '1 – 5',
    steps: [step('1', 'one', 'dim'), step('2', 'two', 'dim'), step('3', 'three', 'yellow'), step('4', 'four', 'cyan'), step('5', 'five', 'magenta')],
  },
]
