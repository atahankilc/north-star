// The one button (D-326, the kit; D-384: empty, round, a lamp for what's on; docs/specs/controls.md). A button has
// nothing behind it at rest, a round shade under the pointer or the keyboard; what kind it is shows only in its ink and,
// for the one that goes, its fill. No brackets, no key after it (keys are in its title and taught by onboarding).
// - `sm` (the default): a 24 px pill, mono, dim; `tone` main is a row's strong one (a dock's `unfocus`), primary the
//   one that goes (a solid cyan pill: save, add, make, apply; at most one on a surface), danger magenta ink, hazard the
//   solid magenta one where deleting is the point (the hazard confirm). `pressed` makes it a switch: a lamp before its
//   word, a hollow ring while `false`, lit while `true`; leave it unset on an action, which gets no lamp.
// - `md`: the page's button, a white pill (36 px), the accent wiping in from the left on hover (`accent`).
// - `icon`: a glyph alone in a circle (24 × 24; a pill when it holds more, `‹ back`, `100%`); `pressed`, the glyph
//   itself lights. A close or take-away is the drawn `CloseIcon` (hudIcons.tsx), never a typed `×`.
// - `link`: no pill, in the row's own colour and size, wrapping, underlined faint on hover: a name that goes somewhere
//   (a card's links, parts and planes in its panel).
// - `look`: the same button drawn as a span, for inside something that is itself the button (a card that's one target).
// A caller's class only places it (margin, flex, shown on hover); it never repaints, repads or resizes it (D-344).
import type { ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from 'react'
import styles from './Button.module.css'

export type ButtonTone = 'primary' | 'danger' | 'main' | 'hazard'
export type Accent = 'magenta' | 'cyan' | 'yellow' | 'blue' | 'green'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode
  // React 19: a ref is a prop, passed on to the <button> (the hazard confirm focuses its cancel).
  ref?: Ref<HTMLButtonElement>
  size?: 'sm' | 'md'
  tone?: ButtonTone
  accent?: Accent
  pressed?: boolean
  icon?: boolean
  link?: boolean
  look?: boolean
}

export function Button({ children, size = 'sm', tone, accent = 'magenta', pressed, icon, link, look, className, style, type = 'button', ...rest }: Props) {
  const md = size === 'md'
  const cls = [md ? styles.md : styles.sm, className].filter(Boolean).join(' ')
  if (look)
    return (
      <span className={cls} data-tone={tone} data-icon={icon || undefined} data-look aria-hidden style={style}>
        {children}
      </span>
    )
  return (
    <button
      {...rest}
      type={type}
      className={cls}
      data-tone={tone}
      data-icon={icon || undefined}
      data-link={link || undefined}
      aria-pressed={pressed}
      style={md ? ({ '--accent': `var(--accent-${accent})`, ...style } as CSSProperties) : style}
    >
      {md ? <span className={styles.label}>{children}</span> : children}
    </button>
  )
}
