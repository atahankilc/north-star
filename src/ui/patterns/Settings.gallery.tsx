import { example } from '../../gallery/example'
import { Button } from '../primitives/Button'
import { Choice } from '../primitives/Choice'
import { Note, Row, Section, SettingsButton } from './Settings'

export default example({
  name: 'Settings',
  place: 'overlays/settings',
  also: ['forms/layout'],
  file: 'src/ui/patterns/Settings.tsx',
  note: 'the modal from the gear or your square (D-097); its parts: Section, Row, Note',
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
        const b = [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find((x) => x.textContent?.trim() === 'display')
        b?.click()
      },
    },
    parts: () => (
      <div style={{ width: 640 }}>
        <Section label="general" note={<Note>Only owners change the name.</Note>}>
          <Row label="name" hint="shown to everyone in it">
            Pazar
          </Row>
          <Row label="theme" hint="this browser">
            <Choice label="theme" bare options={['dark', 'light', 'system'] as const} value="dark" onChange={() => {}} />
          </Row>
          <Row label="leave" hint="you can be invited back">
            <Button size="md">leave</Button>
          </Row>
        </Section>
        <Note tone="error">Couldn’t save: you’re offline.</Note>
      </div>
    ),
  },
})
