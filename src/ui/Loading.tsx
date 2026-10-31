// A line that says something is on its way (D-098): the one spinner (Spinner.tsx, D-326) and what's loading.
import { Spinner } from './Spinner'
import styles from './Loading.module.css'

export function Loading({ label, className }: { label: string; className?: string }) {
  return (
    <p className={[styles.loading, className].filter(Boolean).join(' ')} role="status">
      <Spinner />
      {label}
    </p>
  )
}
