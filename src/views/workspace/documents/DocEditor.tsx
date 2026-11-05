// A .md written in the app (D-373): typed on the page as it reads, never its Markdown, with a word processor's tools
// over it. Tiptap (ProseMirror) holds the page; what's saved is Markdown again (@tiptap/markdown), so the reader, the
// agent, export and download read it as before. Lazy: this file and Tiptap load only when someone writes.
//
// Saving (D-330's pace): a 500 ms pause, leaving the page, a hidden tab or closing writes it. While it's being typed in,
// a change from someone else waits (last write wins, D-071); with the keyboard away, theirs is taken.
//
// What the reader can't show is kept, never dropped: an image is its alt text in brackets (nothing is fetched, as in
// the reader), raw HTML stays as text.
import { Editor, type ChainedCommands } from '@tiptap/core'
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
import { plural } from '../../../model/words'
import { wordsOf } from '../../../model/notes'
import { AUTOSAVE_MS } from '../../../ui/foundation/feel'
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

type Props = {
  text: string
  onSave: (text: string) => void
  label: string
  // Puts the keyboard in it at once (a new document, `edit`).
  autoFocus?: boolean
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

export function DocEditor({ text, onSave, label, autoFocus = false }: Props) {
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
    if (!host.current) return
    const e = new Editor({
      element: host.current,
      extensions: [
        StarterKit.configure({
          underline: false,
          link: { openOnClick: false, autolink: true },
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
      ],
      content: text,
      contentType: 'markdown',
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
    e.on('transaction', redraw)
    e.on('update', () => {
      dirty.current = true
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => flush(e), AUTOSAVE_MS)
    })
    e.on('blur', () => flush(e))
    const hidden = () => document.visibilityState === 'hidden' && flush(e)
    document.addEventListener('visibilitychange', hidden)
    setEditor(e)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      flush(e)
      e.destroy()
      setEditor(null)
    }
    // The page is made once; a new text comes in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Someone else's change (or an undo from outside): taken while this page isn't being typed in.
  useEffect(() => {
    if (!editor || text === known.current || dirty.current || editor.isFocused) return
    known.current = text
    editor.commands.setContent(text, {
      contentType: 'markdown',
      emitUpdate: false,
    })
  }, [editor, text])

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
  const words = editor ? wordsOf(editor.getText()) : wordsOf(text)

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
          <span className={styles.count}>{plural(words, 'word')}</span>
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
