// Ink (D-277): the shade text on the canvas sits on, line by line (each line as long as itself, `box-decoration-break:
// clone`), so it reads over the backdrop as if printed on it, never a box with holes round it. The page's colour, or the
// piece's surface inside one (D-274). For headings, paragraphs, the project title, a section's name, sticky notes' no.
import type { ReactNode } from 'react'
import styles from './Ink.module.css'

export function Ink({ children }: { children: ReactNode }) {
  return <span className={styles.ink}>{children}</span>
}

export const inkClass = styles.ink
