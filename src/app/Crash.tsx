// What shows when a page throws while drawing, or its code can't be loaded (a tab left open across a deploy, chunks.ts):
// one line saying so and a way out, instead of a blank screen. It lets go when the address changes.
import { Component, type ReactNode } from 'react'
import { Button } from '../ui/primitives/Button'
import { WORKSPACES } from './paths'
import styles from './Crash.module.css'

type Props = { children: ReactNode; at: string }
type State = { error: unknown; at: string | null }

// A chunk that can't be fetched reads the same in every browser once it's thrown: a dynamic import's failure.
const isChunkError = (e: unknown) =>
  e instanceof Error && /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(e.message)

export class Crash extends Component<Props, State> {
  state: State = { error: null, at: null }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Going somewhere else tries again.
    if (state.error && state.at !== null && state.at !== props.at) return { error: null, at: props.at }
    return state.at === props.at ? null : { at: props.at }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const text = isChunkError(error) ? 'A new version is out. Reload to get it.' : 'Something went wrong drawing this page.'
    return (
      <main className={styles.crash} role="alert">
        <p>{text}</p>
        <div className={styles.actions}>
          <Button size="md" tone="primary" onClick={() => location.reload()}>
            reload
          </Button>
          <Button link onClick={() => location.assign(import.meta.env.BASE_URL.replace(/\/$/, '') + WORKSPACES)}>
            ← back to workspaces
          </Button>
        </div>
      </main>
    )
  }
}
