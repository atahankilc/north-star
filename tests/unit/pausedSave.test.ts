// @vitest-environment happy-dom
// Saving while typing (src/ui/foundation/pausedSave.ts, D-388): one pause for canvas text, a document's page and
// AutosaveField: after AUTOSAVE_MS without a change, on a hidden tab, and on closing; never when nothing waits.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pausedSave } from '../../src/ui/foundation/pausedSave'
import { AUTOSAVE_MS } from '../../src/ui/foundation/feel'

const hide = (state: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('pausedSave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => (vi.useRealTimers(), hide('visible')))

  it('saves once, a pause after the last change', () => {
    const save = vi.fn()
    const p = pausedSave(save)
    p.later()
    vi.advanceTimersByTime(AUTOSAVE_MS - 1)
    p.later()
    vi.advanceTimersByTime(AUTOSAVE_MS - 1)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledTimes(1)
    p.close()
    expect(save).toHaveBeenCalledTimes(1)
  })
  it('saves on a hidden tab, on flush and on close, only when something waits', () => {
    const save = vi.fn()
    const p = pausedSave(save)
    hide('hidden')
    p.flush()
    expect(save).not.toHaveBeenCalled()
    p.later()
    hide('hidden')
    expect(save).toHaveBeenCalledTimes(1)
    p.later(2000)
    p.flush()
    expect(save).toHaveBeenCalledTimes(2)
    p.later()
    p.close()
    expect(save).toHaveBeenCalledTimes(3)
    // Closed: a hidden tab no longer reaches it, and the timer is gone.
    hide('hidden')
    vi.advanceTimersByTime(5000)
    expect(save).toHaveBeenCalledTimes(3)
  })
})
