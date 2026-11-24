import { example } from '../../gallery/example'
import { LegalLinks } from './LegalLinks'

export default example({
  name: 'LegalLinks',
  place: 'overlays/settings',
  file: 'src/ui/patterns/LegalLinks.tsx',
  note: 'the legal pages on atem-lab.com (D-432): the landing and Settings → account',
  states: { links: () => <LegalLinks /> },
})
