// A wizard's first step (D-212, D-218, D-268; D-361: each wizard had written it): its templates as cards, then `my
// own`, which goes on to the next steps.
import { Options } from '../../../ui/patterns/Options'

const OWN = '__own'

type Props = { templates: { key: string; name: string; hint: string }[]; value: string | null; onPick: (key: string | null) => void; own: string }

export function StartFrom({ templates, value, onPick, own }: Props) {
  return (
    <Options
      pick="one"
      cards
      label="Start from"
      value={value ?? OWN}
      options={[...templates.map((t) => ({ value: t.key, label: t.name, line: t.hint })), { value: OWN, label: 'my own', line: own }]}
      onChange={(key) => onPick(!key || key === OWN ? null : key)}
    />
  )
}
