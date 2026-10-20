// Getting around the chat's report on the stage (D-101), like the preview's stepper (previewNav.ts): ‹ n/N ›, or n and p,
// and a click on a section's row in the chat's report card, go to that section: it opens if folded, scrolls to the top
// of the stage and is lit there and in the chat.
import { isReducedMotion } from '../../state/motion'
import { useReportFocus } from './stage'

const sections = () => [...document.querySelectorAll<HTMLDetailsElement>('[data-report-stage] [data-report-section]')]

export function goToSection(i: number) {
  const all = sections()
  if (all.length === 0) return
  const at = ((i % all.length) + all.length) % all.length
  useReportFocus.setState({ step: at, lit: at })
  const el = all[at]
  el.open = true
  el.scrollIntoView({ block: 'start', behavior: isReducedMotion() ? 'auto' : 'smooth' })
}

export function sectionBy(d: number) {
  const now = useReportFocus.getState().step
  goToSection(now === null ? (d > 0 ? 0 : -1) : now + d)
}
