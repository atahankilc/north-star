import { describe, expect, it } from 'vitest'
import { LESSONS, type PagedLesson } from './lessons'
import { SAMPLE_RELEASES } from './releases.sample'
import { bits, fill, fitTab, newsLessons, newsPages, tabFor, welcomePages } from './words'

describe('words', () => {
  it('fills placeholders, and reads plainly when a name is unknown', () => {
    expect(fill('{owner} started this workspace', { owner: 'Atahan' })).toBe('Atahan started this workspace')
    expect(fill('{peer} is here')).toBe('Someone is here')
  })

  it('splits backticks into key chips', () => {
    expect(bits('Press `0` or `⌘F`.')).toEqual([
      { text: 'Press ', key: false },
      { text: '0', key: true },
      { text: ' or ', key: false },
      { text: '⌘F', key: true },
      { text: '.', key: false },
    ])
    expect(bits('a `b')).toEqual([
      { text: 'a ', key: false },
      { text: '`b', key: false },
    ])
  })

  it("names the welcome's tabs", () => {
    const welcome = LESSONS.find((l) => l.id === 'welcome') as PagedLesson
    const pages = welcomePages(welcome.pages.filter((p) => p.audience !== 'invited' && !p.roles?.includes('viewer')), 'editor', {})
    expect(pages.map((p) => p.tab)).toEqual(['canvas', 'pieces', 'add', 'together'])
    expect(pages[3].extra).toBeUndefined()
    const viewer = welcomePages(welcome.pages.slice(-1), 'viewer', {})
    expect(viewer[0].extra).toMatch(/viewer/)
    expect(tabFor({ title: 'Make your first card' })).toBe('card')
  })

  it("makes what's new: three pages and `+ N more` past four", () => {
    const pages = newsPages(SAMPLE_RELEASES)
    expect(pages).toHaveLength(4)
    expect(pages[0]).toMatchObject({ title: 'Decks and days', go: { action: 'side-view' } })
    expect(pages[3]).toMatchObject({ tab: '+ 2 more', title: 'And 2 more' })
    expect(pages[3].list).toHaveLength(2)
    expect(newsPages([SAMPLE_RELEASES[1]])).toEqual([])
    expect(newsLessons(SAMPLE_RELEASES)).toContain('side-view')
  })

  it('cuts a tab at a word, never mid-word or with a space before `…`', () => {
    expect(fitTab('decks and days', 20)).toBe('decks and days')
    expect(fitTab('decks and days', 13)).toBe('decks')
    expect(fitTab('timeline as a strip', 13)).toBe('timeline')
    expect(fitTab('several canvases', 13)).toBe('several')
    expect(fitTab('canvases', 5)).toBe('canv…')
    expect(fitTab('+ 2 more', 13)).toBe('+ 2 more')
    for (const max of [4, 6, 9, 13]) for (const t of ['decks and days', 'timeline as a strip', 'filters that pass', 'card faces']) {
      const out = fitTab(t, max)
      expect(out.length).toBeLessThanOrEqual(max)
      expect(out).not.toMatch(/\s…|\s$/)
    }
  })

  it("what's new: the sample's tabs are its short ones; `[show me]` only where it can go", () => {
    expect(newsPages(SAMPLE_RELEASES).map((p) => p.tab)).toEqual(['decks', 'timeline', 'canvases', '+ 2 more'])
    const none = newsPages(SAMPLE_RELEASES, (a) => a !== 'side-view')
    expect(none[0].go).toBeUndefined()
    expect(none[2].go?.action).toBe('crumb-prompt')
    // The list page has a line too (not an empty window under its title).
    expect(newsPages(SAMPLE_RELEASES)[3].body).not.toBe('')
  })
})
