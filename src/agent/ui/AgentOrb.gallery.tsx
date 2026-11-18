import { example } from '../../gallery/example'
import { tokenPx } from '../../styles/cssToken'
import { AgentOrb } from './AgentOrb'

const size = () => tokenPx('--orb')
const big = () => size() * 2

export default example({
  name: 'AgentOrb',
  place: 'feedback/agent',
  also: ['motion/loops'],
  file: 'src/agent/ui/AgentOrb.tsx',
  note: 'the agent’s mascot (D-407, back from 1.0’s D-078): an ASCII sphere with eyes, moods under the pointer, antics when left alone; type `nar` outside a field for the pomegranate (D-092); still under reduced motion',
  states: {
    idle: () => <AgentOrb size={size()} mood="idle" />,
    'idle, big': { render: () => <AgentOrb size={big()} mood="idle" />, note: 'twice its size, to see the face; antics come every 3–7 s' },
    hover: { render: () => <AgentOrb size={big()} mood="hover" />, note: 'a new mood every few seconds: laughing, angry, shy, in love, starry, suspicious' },
    open: { render: () => <AgentOrb size={big()} mood="open" />, note: 'the prompt has the keyboard: curious, head tilting' },
    thinking: { render: () => <AgentOrb size={big()} mood="thinking" />, note: 'a job running: faster spin, cyan shimmer' },
    talking: () => <AgentOrb size={big()} mood="talking" />,
    pomegranate: {
      render: () => <AgentOrb size={big()} mood="idle" />,
      setup: async ({ wait }) => {
        await wait(300)
        ;(window as unknown as { __orbPom?: () => void }).__orbPom?.()
      },
      note: 'the easter egg (D-092), turned on here at once; `nar` turns it back (it bursts first)',
    },
  },
})
