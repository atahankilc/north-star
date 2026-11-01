// The empty state (D-326's kit): one faint line saying what isn't there yet (`no tasks yet`, `nothing rated yet`).
// `as` p (default) or span; `tone` dim when it should read more.
import type { CSSProperties, ReactNode } from 'react'
import styles from './Empty.module.css'

export function Empty({ children, as: Tag = 'p', tone, className, style }: { children: ReactNode; as?: 'p' | 'span' | 'div'; tone?: 'faint' | 'dim'; className?: string; style?: CSSProperties }) {
  return (
    <Tag className={[styles.empty, className].filter(Boolean).join(' ')} data-tone={tone === 'dim' ? 'dim' : undefined} style={style}>
      {children}
    </Tag>
  )
}
