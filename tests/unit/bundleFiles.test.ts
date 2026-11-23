// Files in an export (D-425): an image's or a PDF's bytes travel in the .zip under files/<id>/, never in workspace.json,
// and come back out; a file's document is cleaned to what the rules take, and refused when it names no file.
import { describe, expect, it } from 'vitest'
import { BUNDLE_COLLECTIONS, makeBundle, readBundle, zipBundle, type BundleCollection, type Raw } from '../../src/io/bundle'
import { cleanFileDocument, type Ids } from '../../src/model/clean'

const ids: Ids = { card: () => undefined, piece: () => undefined, doc: () => undefined, folder: (v) => (v === 'f1' ? 'F1' : undefined) }
const empty = Object.fromEntries(BUNDLE_COLLECTIONS.map((c) => [c, []])) as unknown as Record<BundleCollection, Raw[]>

describe('files in a bundle', () => {
  it('travel in the zip beside workspace.json and come back out', async () => {
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
    const doc = { id: 'd1', kind: 'image', title: 'Shelf', contentType: 'image/png', size: 7, file: 'files/d1/shelf.png' }
    const zip = zipBundle({ ...makeBundle({ name: 'Acme' }, empty, [doc]), files: { 'files/d1/shelf.png': png } })
    const back = await readBundle(new File([await zip.arrayBuffer()], 'acme.zip'))
    expect(back.files?.['files/d1/shelf.png']).toEqual(png)
    expect(back.documents[0]).toMatchObject({ id: 'd1', file: 'files/d1/shelf.png' })
    expect(JSON.stringify(back.documents)).not.toContain('137,80')
  })

  it("a file's document keeps what the rules take", () => {
    const clean = cleanFileDocument(
      { id: 'd1', kind: 'pdf', title: ' Plan ', contentType: 'application/pdf', size: 2048, pages: 3, uid: 'someone', path: 'workspaces/x/documents/d1/plan.pdf', file: 'files/d1/plan.pdf', thumb: 'files/d1/thumb.webp', folderId: 'f1', shared: true, createdAt: 1, updatedAt: 2 },
      9,
      ids,
    )
    expect(clean).toMatchObject({ file: 'files/d1/plan.pdf', thumb: 'files/d1/thumb.webp', contentType: 'application/pdf' })
    expect(clean?.summary).toMatchObject({ kind: 'pdf', title: 'Plan', size: 2048, pages: 3, shared: true, folderId: 'F1' })
    expect(clean?.summary).not.toHaveProperty('uid')
    expect(clean?.summary).not.toHaveProperty('path')
  })

  it('refuses one that names no file, a wrong type or a path outside files/', () => {
    const base = { id: 'd1', kind: 'image', title: 'Shelf', contentType: 'image/png', size: 7 }
    expect(cleanFileDocument(base, 9, ids)).toBeNull()
    expect(cleanFileDocument({ ...base, file: '../etc/passwd' }, 9, ids)).toBeNull()
    expect(cleanFileDocument({ ...base, contentType: 'text/html', file: 'files/d1/a.html' }, 9, ids)).toBeNull()
    expect(cleanFileDocument({ ...base, kind: 'pdf', file: 'files/d1/shelf.png' }, 9, ids)).toBeNull()
  })
})
