// The empty state (D-326's kit): one faint line saying what isn't there yet (`no tasks yet`, `nothing rated yet`).
// `as` p (default) or span. One tone (D-366's dim: faint is for marks, never words).
import type { CSSProperties, ReactNode } from 'react'
import styles from './Empty.module.css'

export function Empty({ children, as: Tag = 'p', className, style }: { children: ReactNode; as?: 'p' | 'span' | 'div'; className?: string; style?: CSSProperties }) {
  return (
    <Tag className={[styles.empty, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </Tag>
  )
}
