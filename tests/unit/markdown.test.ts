// The document reader's Markdown: what a real .md or an agent's document holds must draw, never bring the page down.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../../src/ui/primitives/Markdown'
import { excerptOf } from '../../src/model/notes'

const html = (text: string, links = true) => renderToStaticMarkup(h(Markdown, { text, links }))

describe('Markdown', () => {
  it('draws a bare url (it matched itself for ever and crashed the workspace)', () => {
    expect(html('see https://example.com/report now')).toContain('href="https://example.com/report"')
    expect(html('see https://example.com/report', false)).toContain('https://example.com/report')
  })
  it('draws a link whose text is a url', () => {
    expect(html('[https://a.co](https://a.co)')).toContain('href="https://a.co"')
  })
  it('leaves what ends the sentence out of a bare url', () => {
    expect(html('at https://a.co/x_y, then')).toContain('href="https://a.co/x_y"')
    expect(html('at https://a.co.')).toMatch(/<\/a>\.<\/p>/)
  })
  it('takes a link with a title or brackets in its url', () => {
    expect(html('[site](https://a.co "The title")')).toContain('href="https://a.co"')
    expect(html('[w](https://a.co/Foo_(bar)) ok')).toContain('href="https://a.co/Foo_(bar)"')
  })
  it('keeps snake_case whole, and still reads _italic_', () => {
    expect(html('use file_name_here')).toContain('use file_name_here')
    expect(html('an _italic_ word')).toContain('<em>italic</em>')
  })
  it('reads bold italic, and italic inside bold', () => {
    expect(html('***big*** word')).toContain('<strong><em>big</em></strong>')
    expect(html('**bold *in* it** end')).toContain('<strong>bold <em>in</em> it</strong>')
  })
  it('shows an escaped mark as itself', () => {
    expect(html('a \\* b \\_ c')).toContain('a * b _ c')
  })
  it('takes a table right after a line of text, and a pipe escaped in a cell', () => {
    expect(html('Intro:\n| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table')
    expect(html('| a | b |\n|---|---|\n| x \\| y | z |')).toContain('x | y')
  })
})

describe('excerptOf', () => {
  it('drops list marks and a table rule, keeps snake_case', () => {
    expect(excerptOf('# T\n\nuse file_name_here\n\n- one\n- two\n\n| a |\n|---|\n| b |')).toBe('use file_name_here one two a b')
  })
})
