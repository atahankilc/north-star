import type { ButtonHTMLAttributes } from 'react'
import { Button, type Accent } from './Button'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { accent?: Accent }

// `[ LABEL ]`-style button (docs/DESIGN.md §6): Button's `md` (D-326). A plain <button>'s type (submit) as before.
export function AsciiButton({ accent = 'magenta', type = 'submit', children, ...rest }: Props) {
  return (
    <Button {...rest} size="md" accent={accent} type={type}>
      {children}
    </Button>
  )
}
