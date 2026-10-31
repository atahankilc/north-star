import { example, type GalleryCtx } from '../gallery/example'
import { useHistory } from '../data/history'
import { Toast } from './Toast'

const say = (text: string, action?: string) => (_c: GalleryCtx) => useHistory.getState().say(text, action ? { label: action, run: () => {} } : undefined)

export default example({
  name: 'Toast',
  place: 'feedback/notices',
  file: 'src/ui/Toast.tsx',
  note: 'bottom centre, 2.6 s (6 s with an action); \\ shows it again',
  states: {
    done: { size: 'full', render: () => <Toast />, setup: say('Deleted 3 cards') },
    'with action': { size: 'full', render: () => <Toast />, setup: say('Moved Rivals to Research', '[go there]') },
    long: { size: 'full', render: () => <Toast />, setup: say('Undid: put “Lunch near the office is expensive and samey” on Pazar and Rivals') },
  },
})
