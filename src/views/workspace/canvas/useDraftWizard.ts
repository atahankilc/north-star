// What a piece's wizard (a matrix, a table, a deck; D-212, D-218, D-268) works on (D-361: each had written it): its step,
// the template picked (none once anything's changed by hand) and a draft of the setup, nothing written until it's made.
// `base` fills what a template leaves out (a deck's empty columns). `make` closes it, puts the piece at the middle of
// the canvas and leaves it in edit mode there, to be moved where you want it.
import { useState } from 'react'
import { addPiece } from '../../../data/pieces'
import type { WithId } from '../../../data/hooks'
import type { Piece } from '../../../data/model'
import { canvasCenter, setEditing } from '../../../state/canvasView'

export type WizardTemplate<S> = { key: string; name: string; hint: string; setup: () => S }

export function useDraftWizard<S extends object, T = S>(templates: WizardTemplate<T>[], base: (t: T) => S) {
  const [step, setStep] = useState(0)
  const [template, setTemplate] = useState<string | null>(templates[0].key)
  const [draft, setDraft] = useState<S>(() => base(templates[0].setup()))
  // A change by hand: the template's no longer what it is.
  const edit = (next: S | ((d: S) => S)) => {
    setDraft(next)
    setTemplate(null)
  }
  // Some fields changed; one set to undefined is taken out.
  const patch = (p: Partial<S>) =>
    edit((d) => {
      const next = { ...d, ...p }
      for (const k of Object.keys(p) as (keyof S)[]) if (p[k] === undefined) delete next[k]
      return next
    })
  // A template picked at the start, or `my own` (null): its own answers, from the next step.
  const start = (key: string | null) => {
    const t = templates.find((x) => x.key === key)
    if (!t) return setStep(1)
    setDraft(base(t.setup()))
    setTemplate(t.key)
  }
  return { step, setStep, template, draft, edit, patch, start, templateName: templates.find((t) => t.key === template)?.name }
}

export async function makeFromWizard(close: () => void, wid: string, kind: Piece['kind'], pieces: WithId<Piece>[], setup: object, name?: string) {
  close()
  const id = await addPiece(wid, kind, canvasCenter(wid), pieces, setup as never, name)
  setEditing(id, true)
}

// The preview's foot says when it shows only some.
export const firstFew = (more: boolean) => (more ? ' · the first few shown' : '')
