// A .md written in the app (D-373): typed on the page as it reads, never its Markdown, with a word processor's tools
// over it. Tiptap (ProseMirror) holds the page; what's saved is Markdown again (@tiptap/markdown), so the reader, the
// agent, export and download read it as before. Lazy: this file and Tiptap load only when someone writes.
//
// Saving (D-330's pace): a 500 ms pause, leaving the page, a hidden tab or closing writes it. While it's being typed in,
// a change from someone else waits (last write wins, D-071); with the keyboard away, theirs is taken.
//
// Written together (D-374, `live`, docs/specs/live-writing.md): the page is a Yjs document several people type in at
// once (liveText.ts), each change merged on every screen, others' carets and selections in their colour with their name.
// Undo is yours only (Yjs's own). The Markdown underneath is written again after a 2 s pause in your typing, leaving, a
// hidden tab or closing; the page waits for the shared text before it can be typed in.
//
// What the reader can't show is kept, never dropped: an image is its alt text in brackets (nothing is fetched, as in
// the reader), raw HTML stays as text.
import { Editor, type ChainedCommands, type AnyExtension } from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { prosemirrorToYDoc } from '@tiptap/y-tiptap'
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Placeholder } from '@tiptap/extensions'
import Image from '@tiptap/extension-image'
import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../../ui/primitives/Button'
import { ButtonGroup } from '../../../ui/primitives/ButtonGroup'
import { Field } from '../../../ui/primitives/Field'
import { Select } from '../../../ui/patterns/Select'
import { AUTOSAVE_MS, LIVE_TEXT_PAUSE_MS } from '../../../ui/foundation/feel'
import { decodePosition, encodePosition, openLiveText, REMOTE, type LiveText, type LiveTransport } from '../../../data/liveText'
import md from '../../../ui/primitives/Markdown.module.css'
import styles from './DocEditor.module.css'

// An image is shown as `[alt]`, never fetched (the reader's rule), and saved back as it came.
const QuietImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        class: md.image,
        'data-src': HTMLAttributes.src,
        title: HTMLAttributes.src,
      },
      `[${HTMLAttributes.alt || 'image'}]`,
    ]
  },
})

// Tiptap leaves blank lines round a table; one is enough.
const tidy = (text: string) => text.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '')

// Others' carets (presence's `doc`, D-374), the positions as they travel (base64); `color` as drawn.
export type LiveCaret = { uid: string; name: string; color: string; a: string; h: string }
export type LiveSetup = {
  transport: () => LiveTransport
  // You, as your caret shows to the others.
  user: { name: string; color: string }
  carets: {
    list: () => LiveCaret[]
    listen: (fn: () => void) => () => void
    // Your caret (null: here, the keyboard elsewhere), and gone when the page closes.
    here: (c: { a: string; h: string } | null) => void
    gone: () => void
  }
  onError?: (e: unknown) => void
}

// The others' carets as a y-protocols Awareness, what the caret extension reads: one made-up client id per person.
function caretAwareness(doc: Y.Doc, carets: LiveSetup['carets']) {
  const aw = new Awareness(doc)
  const ids = new Map<string, number>()
  const idOf = (uid: string) => {
    let id = ids.get(uid)
    if (id === undefined) {
      let h = 7
      for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
      id = h === aw.clientID || h === 0 ? h + 1 : h
      ids.set(uid, id)
    }
    return id
  }
  const sync = () => {
    const added: number[] = []
    const updated: number[] = []
    const removed: number[] = []
    const seen = new Set<number>()
    for (const c of carets.list()) {
      try {
        const id = idOf(c.uid)
        const cursor = { anchor: decodePosition(c.a), head: decodePosition(c.h) }
        ;(aw.states.has(id) ? updated : added).push(id)
        aw.states.set(id, { user: { name: c.name, color: c.color }, cursor })
        seen.add(id)
      } catch {
        // A caret that doesn't read is left out.
      }
    }
    for (const id of [...aw.states.keys()]) if (id !== aw.clientID && !seen.has(id)) (aw.states.delete(id), removed.push(id))
    const change = [{ added, updated, removed }, 'remote']
    aw.emit('change', change)
    aw.emit('update', change)
  }
  aw.on('change', (_: unknown, origin: unknown) => {
    if (origin !== 'local') return
    const c = aw.getLocalState()?.cursor
    carets.here(c ? { a: encodePosition(c.anchor), h: encodePosition(c.head) } : null)
  })
  const off = carets.listen(sync)
  sync()
  return {
    aw,
    destroy() {
      off()
      aw.destroy()
    },
  }
}

// Someone's caret: a line in their colour with their name over it; what they've selected shaded in it.
function caretOf(user: Record<string, string>) {
  const el = document.createElement('span')
  el.className = styles.caret
  el.style.setProperty('--peer', user.color)
  const name = document.createElement('span')
  name.className = styles.caretName
  name.textContent = user.name
  el.append(name)
  return el
}
const selectionOf = (user: Record<string, string>) => ({ nodeName: 'span', class: styles.caretSelection, style: `--peer: ${user.color}` })

type Props = {
  text: string
  onSave: (text: string) => void
  label: string
  // Puts the keyboard in it at once (a new document, `edit`).
  autoFocus?: boolean
  // Written together (D-374): `text` then only seeds a document that has no shared text yet.
  live?: LiveSetup
}

type Style = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'quote' | 'code'
const STYLES: { value: Style; label: string }[] = [
  { value: 'p', label: 'text' },
  { value: 'h1', label: 'heading 1' },
  { value: 'h2', label: 'heading 2' },
  { value: 'h3', label: 'heading 3' },
  { value: 'h4', label: 'heading 4' },
  { value: 'quote', label: 'quote' },
  { value: 'code', label: 'code block' },
]

function styleOf(e: Editor): Style {
  if (e.isActive('codeBlock')) return 'code'
  if (e.isActive('blockquote')) return 'quote'
  for (const l of [1, 2, 3, 4] as const) if (e.isActive('heading', { level: l })) return `h${l}`
  return 'p'
}

function setStyle(c: ChainedCommands, s: Style, e: Editor) {
  if (s === 'code') return c.toggleCodeBlock()
  if (s === 'quote') return e.isActive('blockquote') ? c : c.setParagraph().toggleBlockquote()
  const off = e.isActive('blockquote') ? c.lift('blockquote') : c
  if (s === 'p') return off.setParagraph()
  return off.setHeading({ level: Number(s[1]) as 1 | 2 | 3 | 4 })
}

// What every page has, with or without writing together (whose own undo replaces StarterKit's).
const extensionsOf = (live: boolean): AnyExtension[] => [
  StarterKit.configure({
    underline: false,
    link: { openOnClick: false, autolink: true },
    ...(live ? { undoRedo: false } : {}),
  }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
  QuietImage,
  Placeholder.configure({ placeholder: 'Write here…' }),
  Markdown,
]

// A text with no shared state yet (D-374): its Markdown read into the page's own shape, as a Yjs update.
export function seedOf(text: string) {
  const e = new Editor({ extensions: extensionsOf(false), content: text, contentType: 'markdown' })
  const update = Y.encodeStateAsUpdate(prosemirrorToYDoc(e.state.doc, 'default'))
  e.destroy()
  return update
}

export function DocEditor({ text, onSave, label, autoFocus = false, live }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  // What's on the server as far as this page knows: what came in, or what it last wrote.
  const known = useRef(text)
  const dirty = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const save = useRef(onSave)
  save.current = onSave
  const [linking, setLinking] = useState<string | null>(null)
  const [opening, setOpening] = useState<'open' | 'opening' | 'failed'>(live ? 'opening' : 'open')

  const flush = (e: Editor | null) => {
    window.clearTimeout(timer.current)
    if (!e || !dirty.current) return
    dirty.current = false
    const out = tidy(e.getMarkdown())
    if (out === known.current) return
    known.current = out
    save.current(out)
  }

  useEffect(() => {
    const el = host.current
    if (!el) return
    let e: Editor | null = null
    let closed = false
    let shared: LiveText | null = null
    let carets: ReturnType<typeof caretAwareness> | null = null
    const hidden = () => document.visibilityState === 'hidden' && (shared?.flush(), flush(e))
    const later = (ms: number) => {
      dirty.current = true
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => flush(e), ms)
    }
    const make = (more: AnyExtension[]) => {
      e = new Editor({
        element: el,
        extensions: [...extensionsOf(!!live), ...more],
        ...(live ? {} : { content: text, contentType: 'markdown' as const }),
        autofocus: autoFocus ? 'end' : false,
        editorProps: {
          attributes: {
            class: `${md.md} ${styles.page}`,
            'aria-label': label,
            'aria-multiline': 'true',
            role: 'textbox',
          },
        },
      })
      const made = e
      made.on('transaction', redraw)
      // Written together, only your own changes (and undos) write the Markdown; theirs is written by them.
      if (!live) made.on('update', () => later(AUTOSAVE_MS))
      made.on('blur', () => (shared?.flush(), flush(made)))
      setEditor(made)
    }
    document.addEventListener('visibilitychange', hidden)
    if (!live) make([])
    else {
      const lt = openLiveText(live.transport(), { seed: () => seedOf(text), onError: live.onError })
      shared = lt
      lt.doc.on('update', (_u: Uint8Array, origin: unknown) => origin !== REMOTE && e && later(LIVE_TEXT_PAUSE_MS))
      lt.ready.then(
        () => {
          if (closed) return
          carets = caretAwareness(lt.doc, live.carets)
          make([
            Collaboration.configure({ document: lt.doc }),
            CollaborationCaret.configure({ provider: { awareness: carets.aw }, user: live.user, render: caretOf, selectionRender: selectionOf }),
          ])
          // The Markdown as it stands now is known, so opening writes nothing.
          if (e) known.current = tidy(e.getMarkdown())
          setOpening('open')
        },
        () => !closed && setOpening('failed'),
      )
    }
    return () => {
      closed = true
      document.removeEventListener('visibilitychange', hidden)
      flush(e)
      e?.destroy()
      carets?.destroy()
      shared?.close()
      live?.carets.gone()
      setEditor(null)
    }
    // The page is made once; a new text comes in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Someone else's change (or an undo from outside): taken while this page isn't being typed in.
  useEffect(() => {
    // Written together, the page is the shared text: the Markdown only follows it.
    if (live || !editor || text === known.current || dirty.current || editor.isFocused) return
    known.current = text
    editor.commands.setContent(text, {
      contentType: 'markdown',
      emitUpdate: false,
    })
  }, [editor, text, live])

  const run = (f: (c: ChainedCommands) => ChainedCommands) => editor && f(editor.chain().focus()).run()
  const on = (name: string, attrs?: Record<string, unknown>) => !!editor?.isActive(name, attrs)
  const tool = (glyph: ReactNode, title: string, f: (c: ChainedCommands) => ChainedCommands, pressed?: boolean, disabled?: boolean) => (
    <Button
      icon
      title={title}
      aria-label={title}
      pressed={pressed}
      disabled={!editor || disabled}
      onMouseDown={(ev) => ev.preventDefault()}
      onClick={() => run(f)}
    >
      {glyph}
    </Button>
  )
  const inTable = on('table')
  const inList = on('bulletList') || on('orderedList') || on('taskList')
  const item = on('taskItem') ? 'taskItem' : 'listItem'

  const openLink = () => {
    if (!editor) return
    setLinking(editor.getAttributes('link').href ?? '')
  }
  const applyLink = (href: string) => {
    setLinking(null)
    const url = href.trim()
    run((c) => {
      const r = c.extendMarkRange('link')
      return url ? r.setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }) : r.unsetLink()
    })
  }

  return (
    <div className={styles.editor}>
      <div className={styles.tools}>
        <div className={styles.bar} role="toolbar" aria-label="Formatting">
          <Select<Style>
            ariaLabel="Paragraph style"
            value={editor ? styleOf(editor) : 'p'}
            options={STYLES}
            onChange={(s) => editor && setStyle(editor.chain().focus(), s, editor).run()}
          />
          <ButtonGroup label="Text">
            {tool(<b>B</b>, 'bold (⌘B)', (c) => c.toggleBold(), on('bold'))}
            {tool(<i>I</i>, 'italic (⌘I)', (c) => c.toggleItalic(), on('italic'))}
            {tool(<s>S</s>, 'struck through', (c) => c.toggleStrike(), on('strike'))}
            {tool('</>', 'code in the line (⌘E)', (c) => c.toggleCode(), on('code'))}
            <Button
              icon
              title="link (⌘K)"
              aria-label="Link"
              pressed={on('link') || linking !== null}
              disabled={!editor}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={openLink}
            >
              ↗
            </Button>
            {tool('⌫', 'clear the formatting', (c) => c.unsetAllMarks().clearNodes())}
          </ButtonGroup>
          <ButtonGroup label="Lists">
            {tool('•', 'bullet list', (c) => c.toggleBulletList(), on('bulletList'))}
            {tool('1.', 'numbered list', (c) => c.toggleOrderedList(), on('orderedList'))}
            {tool('☐', 'checklist', (c) => c.toggleTaskList(), on('taskList'))}
            {tool('⇤', 'out a level (⇧Tab)', (c) => c.liftListItem(item), false, !inList)}
            {tool('⇥', 'in a level (Tab)', (c) => c.sinkListItem(item), false, !inList || !editor?.can().sinkListItem(item))}
          </ButtonGroup>
          <ButtonGroup label="Insert">
            {tool('❝', 'quote', (c) => c.toggleBlockquote(), on('blockquote'))}
            {tool('{ }', 'code block', (c) => c.toggleCodeBlock(), on('codeBlock'))}
            {tool('▦', 'table', (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }), inTable, inTable)}
            {tool('―', 'a line across', (c) => c.setHorizontalRule())}
          </ButtonGroup>
          <ButtonGroup label="History">
            {tool('↶', 'undo (⌘Z)', (c) => c.undo(), false, !editor?.can().undo())}
            {tool('↷', 'redo (⇧⌘Z)', (c) => c.redo(), false, !editor?.can().redo())}
          </ButtonGroup>
        </div>
        {linking !== null && (
          <div className={styles.strip}>
            <span className={styles.stripName}>link</span>
            <Field
              className={styles.linkField}
              size="sm"
              label="Link address"
              placeholder="https://…"
              value={linking}
              onChange={setLinking}
              onEnter={applyLink}
              onEscape={() => (setLinking(null), editor?.commands.focus())}
              autoFocus
            />
            <ButtonGroup>
              <Button tone="primary" onClick={() => applyLink(linking)}>
                apply
              </Button>
              {on('link') && <Button onClick={() => applyLink('')}>remove</Button>}
            </ButtonGroup>
          </div>
        )}
        {inTable && (
          <div className={styles.strip}>
            <span className={styles.stripName}>table</span>
            <ButtonGroup label="Table">
              {tool('+ row above', 'a row above', (c) => c.addRowBefore())}
              {tool('+ row below', 'a row below', (c) => c.addRowAfter())}
              {tool('+ column left', 'a column to the left', (c) => c.addColumnBefore())}
              {tool('+ column right', 'a column to the right', (c) => c.addColumnAfter())}
            </ButtonGroup>
            <ButtonGroup label="Take out">
              {tool('− row', 'take this row out', (c) => c.deleteRow())}
              {tool('− column', 'take this column out', (c) => c.deleteColumn())}
              {tool('delete table', 'take the whole table out', (c) => c.deleteTable())}
            </ButtonGroup>
          </div>
        )}
      </div>
      {opening !== 'open' && (
        <p className={styles.opening}>{opening === 'failed' ? "This document's shared text couldn't be opened. Reload the page to try again." : 'opening the shared text…'}</p>
      )}
      <div
        ref={host}
        className={styles.host}
        onKeyDown={(ev) => {
          if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') (ev.preventDefault(), openLink())
        }}
      />
    </div>
  )
}

export default DocEditor
