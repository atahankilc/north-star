// /w/:wid: one workspace's idea canvas.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createIdea, useEdges, useIdeas } from '../../data/ideas'
import { useWorkspace } from '../../data/workspaces'
import { useCanvas } from '../../state/canvasStore'
import { AsciiButton } from '../../ui/AsciiButton'
import { DecodeText } from '../../ui/DecodeText'
import { Board } from './Board'
import { findFreeSpot } from './cardLayout'
import { DetailPanel } from './DetailPanel'
import styles from './CanvasView.module.css'

export function CanvasView() {
  const { wid = '' } = useParams()
  const workspace = useWorkspace(wid)

  if (workspace.isLoading) return <Status text="Loading workspace" />
  if (workspace.error || !workspace.data) {
    return <Status text="Workspace not found, or you're not a member" back />
  }
  return <Loaded wid={wid} name={workspace.data.name} inviteCode={workspace.data.inviteCode} />
}

function Loaded({ wid, name, inviteCode }: { wid: string; name: string; inviteCode: string }) {
  const ideas = useIdeas(wid)
  const edges = useEdges(wid)
  const select = useCanvas((s) => s.select)

  // Leaving the workspace clears selection; Escape deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      select(null)
    }
  }, [select])

  const addIdea = async () => {
    const [x, y] = findFreeSpot(useCanvas.getState().viewCenter(), ideas.data)
    const id = await createIdea(wid, { x, y })
    select(id)
  }

  return (
    <main className={styles.page}>
      <Board wid={wid} ideas={ideas.data} edges={edges.data} />

      <header className={styles.bar}>
        <span className={styles.crumbs}>
          <Link to="/w" className={styles.home}>
            <span className={styles.hash}>#</span> north-star
          </Link>
          <span className={styles.sep}>/</span>
          <span className={styles.name}>{name}</span>
        </span>
        <InviteChip code={inviteCode} />
      </header>

      <footer className={styles.tools}>
        <AsciiButton onClick={addIdea}>+ Idea</AsciiButton>
        <span className={styles.hints}>
          double-click: new idea · drag: move · shift+drag: link · drag board: pan · scroll: zoom
        </span>
      </footer>

      {!ideas.isLoading && ideas.data.length === 0 && (
        <div className={styles.empty}>
          <DecodeText text="Double-click anywhere to pin your first idea" />
        </div>
      )}

      <DetailPanel wid={wid} ideas={ideas.data} edges={edges.data} />
    </main>
  )
}

function InviteChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const pretty = `${code.slice(0, 4)}-${code.slice(4)}`

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button className={styles.invite} onClick={copy} title="Copy invite code">
      <span className={styles.inviteLabel}>{copied ? 'copied' : 'invite'}</span>
      <span className={styles.code}>{pretty}</span>
    </button>
  )
}

function Status({ text, back }: { text: string; back?: boolean }) {
  return (
    <main className={styles.status}>
      <p>
        <DecodeText text={text} />
      </p>
      {back && (
        <Link to="/w" className={styles.backLink}>
          ← back to workspaces
        </Link>
      )}
    </main>
  )
}
