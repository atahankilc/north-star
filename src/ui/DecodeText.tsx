// Text that "decodes" from random glyphs into its final value: the ASCII entrance motion for DOM text.
import { useEffect, useState } from 'react'

const GLYPHS = '#%@*+=-:.·/\\|<>[]{}'

export function DecodeText({ text, duration = 700, delay = 0 }: { text: string; duration?: number; delay?: number }) {
  const [out, setOut] = useState(() => text.replace(/\S/g, ' '))

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOut(text)
      return
    }
    let raf = 0
    const start = performance.now() + delay
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - start) / duration))
      const settled = Math.floor(p * text.length)
      setOut(
        text
          .split('')
          .map((ch, i) => (i < settled || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join(''),
      )
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, duration, delay])

  return (
    <span aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  )
}
