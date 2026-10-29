import { describe, expect, it } from 'vitest'
import { LESSONS, type PagedLesson } from './lessons'
import { SAMPLE_RELEASES } from './releases.sample'
import { bits, fill, newsLessons, newsPages, tabFor, welcomePages } from './words'

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
})
