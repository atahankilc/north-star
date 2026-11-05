import { useState, type ReactNode } from 'react'
import { example } from '../../gallery/example'
import { Button } from '../primitives/Button'
import { ButtonGroup } from '../primitives/ButtonGroup'
import { Console, ConsoleTab, FloorTitle } from './Console'

// A box standing for what a console hangs on: a piece, the screen, a selection.
function Host({ children, width = 'var(--size-md)', height = 'var(--size-xs)', framed = true }: { children: ReactNode; width?: string; height?: string; framed?: boolean }) {
  return (
    <div style={{ padding: 'var(--space-3) var(--space-3) var(--space-6)' }}>
      <div style={{ position: 'relative', width, height, background: framed ? 'var(--piece)' : 'var(--bg)', border: framed ? 'var(--line-w) solid var(--piece-edge)' : undefined }}>{children}</div>
    </div>
  )
}

function Drawer() {
  const [open, setOpen] = useState<'filter' | 'linked' | null>('filter')
  const flip = (k: 'filter' | 'linked') => setOpen(open === k ? null : k)
  return (
    <Host height="var(--size-xs)" framed={false}>
      <Console
        at="foot"
        info="14 cards"
        floor={
          open && (
            <>
              <FloorTitle summary={open === 'filter' ? '2 types hidden' : undefined} action={open === 'filter' && <Button>reset</Button>}>
                {open}
              </FloorTitle>
              <ButtonGroup>
                <Button pressed>customers</Button>
                <Button pressed>problems</Button>
                <Button>competitors</Button>
              </ButtonGroup>
            </>
          )
        }
      >
        <ButtonGroup>
          <ConsoleTab label="filter" n={2} open={open === 'filter'} onClick={() => flip('filter')} />
          <ConsoleTab label="linked" n={1} open={open === 'linked'} onClick={() => flip('linked')} />
        </ButtonGroup>
        <ButtonGroup>
          <Button tone="main">unfocus</Button>
        </ButtonGroup>
      </Console>
    </Host>
  )
}

export default example({
  name: 'Console',
  place: 'hud/docks',
  also: ['canvas/pieces'],
  file: 'src/ui/patterns/Console.tsx',
  note: 'every console, dock and bar (D-347): a rail, who · groups by role · go last; cut into a piece’s edge, under a selection or on the screen’s foot; faint L’s on its visible corners, cyan when pointed at; past 70 % of its edge it takes the whole edge',
  states: {
    'a piece’s, cut into its edge': () => (
      <Host>
        <Console at="edge">
          <ButtonGroup>
            <Button>⧉ 2</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button>focus</Button>
            <Button>edit</Button>
          </ButtonGroup>
        </Console>
      </Host>
    ),
    'in edit mode, no size': () => (
      <Host>
        <Console at="edge" editing>
          <ButtonGroup>
            <Button>move to…</Button>
            <Button tone="danger">delete</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button tone="primary">done</Button>
          </ButtonGroup>
        </Console>
      </Host>
    ),
    'no room: the whole edge': () => (
      <Host width="var(--size-xs)">
        <Console at="edge">
          <ButtonGroup>
            <Button>‹</Button>
            <Button>2 / 5</Button>
            <Button>›</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button>⇆ 01 Pazar</Button>
            <Button>setup</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button>focus</Button>
            <Button>edit</Button>
          </ButtonGroup>
        </Console>
      </Host>
    ),
    'on the screen’s foot, a drawer open': () => <Drawer />,
    'a bar under a selection, named': () => (
      <Host height="var(--size-xs)" framed={false}>
        <Console at="under" name="link" fill={false} style={{ left: 0, top: 0 }}>
          <ButtonGroup>
            <Button>solves</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button>label</Button>
            <Button>turn round</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button tone="danger">remove</Button>
          </ButtonGroup>
        </Console>
      </Host>
    ),
  },
})
