import { example } from '../../gallery/example'
import { Button } from '../primitives/Button'
import { Choice } from '../primitives/Choice'
import { CommitField } from '../primitives/CommitField'
import { Field } from '../primitives/Field'
import { Note, Row, Section, SettingsButton } from './Settings'

export default example({
  name: 'Settings',
  place: 'overlays/settings',
  also: ['forms/layout'],
  file: 'src/ui/patterns/Settings.tsx',
  note: 'the modal from the gear or your square (D-097; its layout D-404): a head that never scrolls, groups under numbered rules, the control at the row’s right edge; its parts: Section, Row, Note',
  states: {
    buttons: () => (
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <SettingsButton />
      </div>
    ),
    'with badge': () => (
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <SettingsButton workspace={() => null} workspaceName="Pazar" badge={2} />
      </div>
    ),
    'open: account': { render: () => <SettingsButton workspace={() => null} workspaceName="Pazar" />, setup: (c) => c.click('[aria-label^="Account"]'), note: 'a <dialog>: it sits over the gallery; Escape closes it' },
    'open: display': {
      render: () => <SettingsButton workspace={() => null} workspaceName="Pazar" />,
      setup: async (c) => {
        c.click('[aria-label^="Account"]')
        await c.wait(60)
        const b = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] nav button')].find((x) => x.textContent?.trim() === 'display')
        b?.click()
      },
    },
    parts: () => (
      <div style={{ width: 640, display: 'grid', gap: 'var(--space-6)' }}>
        <Section n={1} label="general" count={4} note="Only owners change the name.">
          <Row label="name" hint="Shown to everyone in it.">
            <CommitField line empty="undo" label="Workspace name" value="Pazar" onSave={() => {}} />
          </Row>
          <Row label="theme" hint="This browser.">
            <Choice label="theme" bare options={['dark', 'light', 'system'] as const} value="dark" onChange={() => {}} />
          </Row>
          <Row wide label="what we're building" hint="wide: the control under the words, as wide as the row.">
            <Field label="what we're building" value="Pazar: one place for neighbourhood markets." onChange={() => {}} style={{ flex: 1 }} />
          </Row>
          <Row label="leave" hint="You can be invited back.">
            <Button tone="danger">leave</Button>
          </Row>
        </Section>
        <Section>
          <Row label="one group" hint="No rule: the page's title names it.">
            <Button>do</Button>
          </Row>
        </Section>
        <Note tone="error">Couldn’t save: you’re offline.</Note>
      </div>
    ),
  },
})
