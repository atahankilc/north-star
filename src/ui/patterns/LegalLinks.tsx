// The legal pages (D-432), on atem-lab.com beside the product page: on the landing, before anyone signs in, and in
// Settings → account. Opened in a tab of their own, so a workspace stays as it was.
import styles from './LegalLinks.module.css'

const SITE = 'https://atem-lab.com'
const LINKS = [
  { label: 'Impressum', href: `${SITE}/impressum.html` },
  { label: 'Privacy', href: `${SITE}/privacy.html` },
  { label: 'Terms', href: `${SITE}/terms.html` },
  { label: 'Contact', href: `${SITE}/contact.html` },
  { label: 'Report content', href: `${SITE}/contact.html?topic=report` },
]

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav className={[styles.links, className].filter(Boolean).join(' ')} aria-label="Legal">
      {LINKS.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener">
          {l.label}
        </a>
      ))}
    </nav>
  )
}
