// Three fixture workspaces for the read layer (S10, D-312; agent.md Phase 2): small (the café fixture with every piece
// kind), medium (2 canvases, 6 planes, ~150 cards, 2 matrices, a table, 2 task decks + a priorities deck, a timeline,
// text, documents, comments) and big (3 canvases, 15 planes, ~1500 cards, ~3000 links, 4 matrices, 3 tables, 4 decks
// with ~400 tasks, many texts and stickies, 20 documents). Generated, never exported from live data: a seeded generator
// with startup words, so every run gives the same workspace (no randomness at test time).
import { fromDocs, WS_COLLECTIONS, type Docs, type RawDoc } from '../../../src/model/fromDocs'
import type { ReadWs, MemberInfo, MessageInfo } from '../../../src/agent/read'
import type { DocBody } from '../../../src/data/documents'
import { lensDocs, taskDocs, ID, LENS, TASKS, SEC, T, WORKSPACE, WID } from './ws'

// Now, for today / overdue: 2026-11-03 at noon UTC (the same day in every time zone people run tests in).
export const NOW = Date.UTC(2026, 10, 3, 12)

// ---- A seeded generator (mulberry32)

function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1))
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]
  const chance = (p: number) => next() < p
  const some = <T>(list: readonly T[], n: number): T[] => {
    const copy = [...list]
    const out: T[] = []
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(next() * copy.length), 1)[0])
    return out
  }
  return { next, int, pick, chance, some }
}
type Rng = ReturnType<typeof rng>

const cap = (t: string) => t[0].toUpperCase() + t.slice(1)
const fid = (prefix: string, n: number) => `${prefix}${String(n).padStart(20 - prefix.length, '0')}`
const DAY = 86_400_000
const dayStr = (ms: number) => new Date(ms).toISOString().slice(0, 10)

// ---- Words

type Theme = {
  segments: string[]
  places: string[]
  segmentTails: string[]
  pains: string[]
  brandA: string[]
  brandB: string[]
  verbs: string[]
  objects: string[]
  ideaTails: string[]
  featureNouns: string[]
  tags: string[]
  regions: string[]
  criteria: string[]
  categories: string[]
  evidence: string[]
  sources: string[]
  taskVerbs: string[]
  taskObjects: string[]
  stickies: string[]
  paragraphs: string[]
  headings: string[]
  docTitles: string[]
  docSections: string[]
  comments: string[]
}

const PAZAR: Theme = {
  segments: ['Stall owners', 'Weekend shoppers', 'Young parents', 'Restaurant buyers', 'Students', 'Retired regulars', 'Organic farmers', 'Bakers', 'Office lunch groups', 'Neighbourhood cooks'],
  places: ['in Kadıköy', 'in Kreuzberg', 'in Neukölln', 'in Beşiktaş', 'near the tram', 'on Saturdays', 'without a car', 'who pay cash', 'new to the city', 'with big families'],
  segmentTails: ['', '', ' (core)', ' (early)', ''],
  pains: [
    'sell out by 10am and turn people away',
    'throw away unsold greens every evening',
    "can't tell what is in season this week",
    'carry heavy bags home on foot',
    'wait in long queues at the cheese stall',
    'never know prices before they arrive',
    "can't take card payments",
    'lose regulars when they move away',
    'forget which stall had the good olives',
    'pay too much at the supermarket instead',
    'miss the market when it rains',
    'have no way to reserve the last loaves',
  ],
  brandA: ['Pazar', 'Tezgah', 'Sepet', 'Bazaar', 'Fresh', 'Market', 'Tarla', 'Hasat', 'Green', 'Kiosk', 'Stall', 'Local'],
  brandB: ['ly', 'go', 'box', 'hub', 'now', 'mate', 'run', 'cart', 'direct', 'basket', 'club', 'drop'],
  verbs: ['Pre-order', 'Reserve', 'Share', 'Deliver', 'Bundle', 'Remind about', 'Rate', 'Map', 'Subscribe to', 'Swap'],
  objects: ['the weekly basket', 'leftover produce', 'stall opening hours', 'seasonal boxes', 'bread', 'cheese', 'prices', 'pickup slots', 'recipes', 'loyalty stamps', 'stall reviews', 'market maps'],
  ideaTails: ['from the stall', 'the night before', 'with neighbours', 'by WhatsApp', 'in one tap', 'at a discount', 'for pickup', 'every Friday'],
  featureNouns: ['checkout', 'map', 'reminder', 'catalogue', 'chat', 'ratings', 'push alerts', 'dashboard', 'QR codes', 'pickup slots', 'price list', 'onboarding'],
  tags: ['istanbul', 'berlin', 'b2b', 'b2c', 'pricing', 'logistics', 'retention', 'supply', 'trust', 'mvp'],
  regions: ['Turkey', 'Germany', 'EU', 'Global', 'DACH', 'Europe'],
  criteria: ['works offline', 'Turkish and German', 'pay by card', 'under 3 taps', 'no account needed', 'stall can update it', 'shows stock'],
  categories: ['ordering', 'payments', 'delivery', 'discovery', 'loyalty'],
  evidence: [
    'Said she throws away 4 crates of greens a week',
    'Would pay 2 € more to skip the queue',
    'Uses WhatsApp groups to tell regulars what came in',
    'Asked twice whether we deliver',
    'Only 1 in 8 stalls takes cards',
    'Came back three Saturdays in a row after the reminder',
    'Did not want to install another app',
    'Bought the same basket four weeks running',
  ],
  sources: ['Interview, Kadıköy market', 'Survey of 42 shoppers', 'Stall visit', 'WhatsApp group screenshot', 'Pilot week 2', 'Call with a chef'],
  taskVerbs: ['Interview', 'Call', 'Draft', 'Test', 'Design', 'Ship', 'Write', 'Price', 'Map', 'Visit'],
  taskObjects: ['five stall owners', 'the pickup flow', 'the landing page', 'Saturday pilot', 'the stall onboarding', 'a pricing survey', 'the WhatsApp bot', 'three restaurants', 'the Kreuzberg market', 'the order email'],
  stickies: ['Ask about Sundays', 'Rain = no market?', 'Check card fees', 'Who owns the stall data?', 'Talk to the market office', 'Cash only is a big deal', 'Maybe start with bread', 'Follow up with Ayşe'],
  paragraphs: [
    'Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it.',
    'The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste.',
    'Restaurants buy in bulk early in the morning; they are a different product from weekend shoppers.',
  ],
  headings: ['Who we serve', 'What hurts', 'Who we beat', 'Our bets', 'What we build', 'Open questions', 'Evidence so far'],
  docTitles: ['Interview notes — stall owners', 'Pricing research', 'Pilot week 2 report', 'Competitor teardown', 'Market office meeting', 'Onboarding script'],
  docSections: ['Summary', 'What we heard', 'Numbers', 'Quotes', 'Open questions', 'Next steps'],
  comments: ['Is this still true after the pilot?', 'I think this belongs on Bets.', 'Can we get a second source?', 'Agreed, moving it to testing.', 'Who talked to them?', 'Let us price this first.'],
}

const LEDGER: Theme = {
  segments: ['Freelance designers', 'Solo consultants', 'Small agencies', 'Tax advisors', 'Developers on contract', 'Photographers', 'Translators', 'Coaches', 'Craftspeople', 'Podcasters', 'Video editors', 'Copywriters'],
  places: ['in Germany', 'in France', 'in the Netherlands', 'in Spain', 'who invoice in two currencies', 'starting out', 'with VAT trouble', 'with an accountant', 'without an accountant', 'earning over 100k', 'part-time', 'abroad'],
  segmentTails: ['', '', '', ' (early)', ' (core)'],
  pains: [
    'lose a day each quarter on the VAT return',
    'chase late invoices by hand',
    'mix private and business spending',
    'lose receipts before tax time',
    "can't see what they can spend after tax",
    'pay their accountant for data entry',
    'miss the advance tax deadline',
    'struggle with reverse-charge invoices',
    'keep three spreadsheets that disagree',
    'get fined for late filing',
    "don't know which expenses count",
    'switch tools every year',
    'invoice clients in other currencies',
    'forget to bill for expenses',
  ],
  brandA: ['Ledg', 'Book', 'Tax', 'Fin', 'Inv', 'Pay', 'Cash', 'Sum', 'Quill', 'Tally', 'Count', 'Fisc', 'Kont', 'Acc', 'Rech'],
  brandB: ['ly', 'io', 'ify', 'hub', 'base', 'wise', 'desk', 'flow', 'pilot', 'buddy', 'ster', 'ware', 'go', 'pad'],
  verbs: ['Auto-match', 'Pre-fill', 'Remind about', 'Split', 'Forecast', 'Bundle', 'Scan', 'Categorise', 'Explain', 'Export', 'Reconcile', 'Estimate'],
  objects: ['receipts', 'VAT returns', 'late invoices', 'expenses', 'bank feeds', 'tax reserves', 'mileage', 'client payments', 'quarterly filings', 'reverse-charge invoices', 'currency gains', 'subscriptions'],
  ideaTails: ['from a photo', 'each Friday', 'in one tap', 'before the deadline', 'by voice', 'with the accountant', 'for the year', 'from email'],
  featureNouns: ['import', 'export', 'dashboard', 'reminder', 'scanner', 'sync', 'report', 'templates', 'rules', 'alerts', 'wizard', 'API'],
  tags: ['vat', 'invoicing', 'tax', 'banking', 'onboarding', 'pricing', 'germany', 'france', 'accountants', 'mobile', 'trust', 'growth'],
  regions: ['Germany', 'France', 'Netherlands', 'Spain', 'EU', 'Europe', 'Global', 'UK', 'US', 'DACH'],
  criteria: ['ELSTER export', 'multi-currency', 'bank sync', 'mobile receipt scan', 'accountant access', 'GoBD compliant', 'reverse charge', 'under 10 €/month'],
  categories: ['invoicing', 'banking', 'tax', 'receipts', 'reporting', 'integrations'],
  evidence: [
    'Spends about 6 hours on each VAT return',
    'Has 1,200 € in unpaid invoices older than 60 days',
    'Would switch for automatic receipt matching',
    'Pays the accountant 180 € a month, mostly for typing',
    'Already tried two tools and gave up',
    'Keeps receipts in a shoebox',
    'Asked for an ELSTER export unprompted',
    'Thinks 15 € a month is fair',
    'Does not trust bank sync with a startup',
    'Files late every second quarter',
  ],
  sources: ['Interview', 'Survey (n=210)', 'Support ticket', 'Reddit thread', 'Accountant call', 'Pilot cohort 3', 'Landing page test', 'Sales call'],
  taskVerbs: ['Interview', 'Prototype', 'Write', 'Test', 'Ship', 'Design', 'Benchmark', 'Price', 'Review', 'Spec', 'Fix', 'Measure'],
  taskObjects: ['the VAT wizard', 'five accountants', 'bank sync errors', 'the receipt scanner', 'the onboarding emails', 'ELSTER export', 'the pricing page', 'reverse-charge rules', 'the mobile app', 'the invoice reminder', 'churn interviews', 'the French tax rules', 'the accountant portal', 'the import from Excel'],
  stickies: ['Ask about Kleinunternehmer', 'Accountants as a channel?', 'GoBD before launch', 'Who pays: freelancer or accountant?', 'Check FinTS limits', 'Talk to Lena again', 'France is different', 'Bank sync trust problem', 'Annual plan discount?', 'Too many tools already'],
  paragraphs: [
    'Freelancers do not want bookkeeping; they want to never think about tax. Every feature should remove a decision.',
    'Accountants are both a channel and a competitor: they sell their time on exactly what we automate.',
    'The VAT return is the moment of pain. Everything else is a nice-to-have until that is solved.',
    'Germany first: ELSTER and GoBD are hard, which keeps the big US tools out.',
  ],
  headings: ['Segments', 'Pains', 'Competitors', 'Bets', 'Roadmap', 'Evidence', 'Open questions', 'Channels', 'Pricing', 'Risks'],
  docTitles: ['Interview notes', 'VAT research', 'Competitor teardown', 'Pricing experiment', 'Accountant channel memo', 'Onboarding funnel', 'GoBD checklist', 'Bank sync vendors', 'Churn analysis', 'Roadmap Q1'],
  docSections: ['Summary', 'Background', 'What we heard', 'Numbers', 'Quotes', 'Risks', 'Decision', 'Open questions', 'Next steps', 'Appendix'],
  comments: ['Is this still true?', 'Source?', 'This contradicts the survey.', 'Moving to testing.', 'Can someone call them back?', 'Let us talk about this on Monday.', 'Good catch.', 'I disagree, see the interview notes.'],
}

// ---- One workspace from a spec

type PlaneSpec = { name: string; canvas: number; mix: Partial<Record<'customer' | 'problem' | 'competitor' | 'idea' | 'feature', number>>; packages?: number }
type DeckSpec = { name: string; canvas: number; tasks: number; stuckTo?: number; cols?: string[] }
type Spec = {
  seed: number
  wid: string
  name: string
  description: string
  theme: Theme
  members: (MemberInfo & { role: 'owner' | 'editor' | 'viewer' })[]
  canvases: string[]
  planes: PlaneSpec[]
  links: number
  matrices: number
  tables: number
  decks: DeckSpec[]
  cardDeck: boolean
  timelines: number
  stickies: number
  documents: number
  threads: number
  places: number
}

const TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature'] as const
const COLLECTION: Record<string, string> = { customer: 'customers', problem: 'problems', competitor: 'competitors', idea: 'ideas', feature: 'features', package: 'packages' }
const SECTION_NAME: Record<string, string> = { customer: 'Segments', problem: 'Pains', competitor: 'Rivals', idea: 'Bets', feature: 'Build' }

function generate(s: Spec): ReadWs {
  const r: Rng = rng(s.seed)
  const W = s.theme
  const d: Record<string, RawDoc[]> = Object.fromEntries(WS_COLLECTIONS.map((c) => [c, []]))
  let clock = NOW - 120 * DAY
  const tick = () => (clock += 37 * 60_000)
  const times = () => {
    const createdAt = tick()
    return { createdAt, updatedAt: r.chance(0.08) ? NOW - r.int(1, 96) * 3_600_000 : createdAt }
  }
  const n = { piece: 0, card: 0, label: 0, edge: 0, ev: 0, cf: 0, task: 0, thread: 0, doc: 0 }
  const used = new Set<string>()
  const unique = (make: () => string) => {
    for (let i = 0; i < 25; i++) {
      const t = make()
      if (!used.has(t)) return (used.add(t), t)
    }
    let k = 2
    const base = make()
    while (used.has(`${base} ${k}`)) k++
    used.add(`${base} ${k}`)
    return `${base} ${k}`
  }
  const title = (type: string) => {
    switch (type) {
      case 'customer':
        return unique(() => `${r.pick(W.segments)} ${r.pick(W.places)}${r.pick(W.segmentTails)}`)
      case 'problem':
        return unique(() => `${r.pick(W.segments)} ${r.pick(W.pains)}`)
      case 'competitor':
        return unique(() => `${r.pick(W.brandA)}${r.pick(W.brandB)}`)
      case 'idea':
        return unique(() => `${r.pick(W.verbs)} ${r.pick(W.objects)} ${r.pick(W.ideaTails)}`)
      default:
        return unique(() => `${cap(r.pick(W.objects))} ${r.pick(W.featureNouns)}`.replace(/^(\w)/, (m) => m.toUpperCase()))
    }
  }

  // Canvases and members.
  s.canvases.forEach((name, i) => {
    if (i) d.canvases.push({ id: fid('canv', i), name, order: i, createdAt: tick() })
    else d.canvases.push({ id: 'main', name, order: 0, createdAt: tick() })
  })
  const canvasId = (i: number) => (i ? fid('canv', i) : undefined)
  const uids = s.members.filter((m) => m.role !== 'viewer').map((m) => m.uid)
  const memberName = (uid: string) => s.members.find((m) => m.uid === uid)!.name

  // Project title on the first canvas.
  d.labels.push({ id: fid('labl', ++n.label), pieceId: 'canvas', kind: 'title', text: '', x: -900, y: -500, ...times() })

  // Planes, laid out left to right per canvas.
  const planeIds: string[] = []
  const cardsOf = new Map<string, { id: string; type: string; plane: string }[]>()
  const allCards: { id: string; type: string; plane: string; validation?: string }[] = []
  const colX = new Map<number, number>()
  s.planes.forEach((ps) => {
    const id = fid('plan', ++n.piece)
    planeIds.push(id)
    const counts = TYPES.map((t) => [t, ps.mix[t] ?? 0] as const).filter(([, k]) => k)
    const perRow = 6
    // A block per type: a section round it (or a heading over it), its cards in rows of six.
    let y = 75
    const list: { id: string; type: string; plane: string }[] = []
    counts.forEach(([type, k], bi) => {
      const rows = Math.ceil(k / perRow)
      const sectioned = bi % 2 === 0
      const blockH = 75 + rows * 125
      if (sectioned) d.labels.push({ id: fid('labl', ++n.label), pieceId: id, kind: 'section', text: SECTION_NAME[type], x: 25, y: y - 50, w: perRow * 225 + 25, h: blockH + 25, ...times() })
      else d.labels.push({ id: fid('labl', ++n.label), pieceId: id, size: 'subheading', text: r.pick(W.headings), x: 50, y: y - 50, ...times() })
      for (let i = 0; i < k; i++) {
        const cid = fid(type.slice(0, 4), ++n.card)
        const doc: RawDoc = { id: cid, pieceId: id, x: 50 + (i % perRow) * 225, y: y + Math.floor(i / perRow) * 125, ...times() }
        doc[type === 'competitor' ? 'name' : 'title'] = title(type)
        if (type === 'customer' || type === 'problem' || type === 'idea') doc.validation = r.pick(['hypothesis', 'hypothesis', 'testing', 'testing', 'validated', 'invalidated'])
        if (r.chance(0.35)) doc.tags = r.some(W.tags, r.int(1, 2))
        if (type === 'competitor') {
          doc.regions = r.some(W.regions, r.int(1, 2))
          if (r.chance(0.5)) doc.description = `${r.pick(W.verbs)} ${r.pick(W.objects)} for ${r.pick(W.segments).toLowerCase()}`
          if (r.chance(0.4)) doc.pricing = `${r.int(5, 49)} € a month`
          if (r.chance(0.3)) doc.url = `https://${String(doc.name).toLowerCase()}.example`
        }
        if (type === 'feature') {
          if (r.chance(0.6)) doc.priority = r.pick(['P1', 'P2', 'P3'])
          if (r.chance(0.7)) doc.status = r.pick(['idea', 'planned', 'building', 'shipped'])
          if (r.chance(0.7)) doc.impact = r.pick(['low', 'medium', 'high'])
          if (r.chance(0.7)) doc.effort = r.pick(['S', 'M', 'L'])
          if (r.chance(0.25)) doc.criteria = r.some(W.criteria, r.int(1, 3)).map((t, j) => ({ id: `k${j + 1}`, text: t }))
        }
        if (r.chance(0.15)) doc[type === 'competitor' ? 'notes' : 'body'] = r.pick(W.paragraphs)
        d[COLLECTION[type]].push(doc)
        const c = { id: cid, type, plane: id, validation: doc.validation as string | undefined }
        list.push(c)
        allCards.push(c)
      }
      y += blockH + 50
    })
    // A sticky or two and sometimes a paragraph beside the blocks.
    const right = perRow * 225 + 100
    for (let i = 0; i < Math.round(s.stickies / s.planes.length); i++) {
      const author = r.pick(uids)
      d.labels.push({ id: fid('labl', ++n.label), pieceId: id, kind: 'sticky', text: r.pick(W.stickies), x: right, y: 50 + i * 150, uid: author, author: memberName(author), ...times() })
    }
    if (r.chance(0.5)) d.labels.push({ id: fid('labl', ++n.label), pieceId: id, size: 'note', text: r.pick(W.paragraphs), x: right + 200, y: 50, w: 400, ...times() })
    cardsOf.set(id, list)
    const x = colX.get(ps.canvas) ?? 0
    const w = perRow * 225 + 700
    const h = Math.max(600, y + 50)
    d.pieces.push({ id, kind: 'plane', x, y: 0, w, h, name: ps.name, ...(canvasId(ps.canvas) ? { canvasId: canvasId(ps.canvas) } : {}), ...times() })
    colX.set(ps.canvas, x + w + 150)
    // Packages of a few features each.
    const feats = list.filter((c) => c.type === 'feature')
    for (let k = 0; k < (ps.packages ?? 0) && feats.length >= 3; k++) {
      const members = r.some(feats, r.int(2, 4)).map((c) => c.id)
      const pid = fid('pack', ++n.card)
      const pk: RawDoc = { id: pid, pieceId: id, title: `${cap(r.pick(W.objects))} bundle`, x: right, y: 400 + k * 200, memberIds: members, ...times() }
      if (r.chance(0.5)) pk.impact = r.pick(['medium', 'high'])
      d.packages.push(pk)
      list.push({ id: pid, type: 'package', plane: id })
    }
  })
  const byType = (t: string) => allCards.filter((c) => c.type === t)

  // Links.
  const pairs = new Set<string>()
  const link = (from: { id: string; type: string }, to: { id: string; type: string }, kind: string, label?: string) => {
    const key = `${from.id}>${to.id}`
    if (from.id === to.id || pairs.has(key) || pairs.has(`${to.id}>${from.id}`)) return
    pairs.add(key)
    d.edges.push({ id: fid('edge', ++n.edge), fromId: from.id, fromType: from.type, toId: to.id, toType: to.type, kind, ...(label ? { label } : {}) })
  }
  const customers = byType('customer')
  const problems = byType('problem')
  const ideas = byType('idea')
  const features = byType('feature')
  const competitors = byType('competitor')
  for (let guard = 0; d.edges.length < s.links && guard < s.links * 4; guard++) {
    const roll = r.next()
    if (roll < 0.22 && customers.length && problems.length) link(r.pick([...problems, ...ideas, ...features].filter(Boolean)), r.pick(customers), 'for')
    else if (roll < 0.42 && ideas.length && problems.length) link(r.pick(ideas), r.pick(problems), 'solves')
    else if (roll < 0.55 && competitors.length && (problems.length || ideas.length)) link(r.pick(competitors), r.pick([...problems, ...ideas]), 'competes-with', r.chance(0.1) ? 'same pitch' : undefined)
    else if (roll < 0.7 && features.length && ideas.length) link(r.pick(features), r.pick(ideas), 'inspired-by')
    else if (roll < 0.78) {
      // A part: a feature under another feature of its plane, a problem under a problem.
      const pool = r.chance(0.6) ? features : problems
      if (pool.length < 2) continue
      const a = r.pick(pool)
      const same = pool.filter((c) => c.plane === a.plane && c.id !== a.id)
      if (same.length) link(a, r.pick(same), 'part-of')
    } else if (roll < 0.9 && features.length > 1) link(r.pick(features), r.pick(features), 'depends-on')
    else if (allCards.length > 1) link(r.pick(allCards), r.pick(allCards), r.pick(['relates', 'relates', 'contradicts']))
  }

  // A few cards also on another plane.
  for (let k = 0; k < s.places && planeIds.length > 1; k++) {
    const c = r.pick(allCards)
    const other = r.pick(planeIds.filter((p) => p !== c.plane))
    const pid = `${other}_${c.id}`
    if (d.places.some((p) => p.id === pid)) continue
    d.places.push({ id: pid, planeId: other, cardId: c.id, type: c.type, x: 1450 + (k % 3) * 225, y: 600 + Math.floor(k / 3) * 125, createdAt: tick() })
  }

  // Evidence on customers, problems and ideas that are testing or decided.
  for (const c of allCards) {
    if (!c.validation || c.validation === 'hypothesis' || !r.chance(0.55)) continue
    for (let k = r.int(1, 3); k > 0; k--)
      d.evidence.push({
        id: fid('evid', ++n.ev),
        nodeId: c.id,
        nodeType: c.type,
        kind: r.pick(['interview', 'quote', 'data', 'observation', 'link']),
        text: r.pick(W.evidence),
        stance: c.validation === 'invalidated' ? (r.chance(0.8) ? 'contradicts' : 'supports') : r.chance(0.8) ? 'supports' : 'contradicts',
        ...(r.chance(0.7) ? { source: r.pick(W.sources) } : {}),
        date: dayStr(NOW - r.int(2, 90) * DAY),
        createdAt: tick(),
      })
  }
  // Competitors' features, and which of ours they match.
  for (const c of competitors)
    for (let k = r.int(0, 4); k > 0; k--) {
      const cf = fid('cfea', ++n.cf)
      d.competitorFeatures.push({ id: cf, competitorId: c.id, name: `${cap(r.pick(W.objects))} ${r.pick(W.featureNouns)}`, category: r.pick(W.categories), availability: r.pick(['free', 'paid', 'enterprise', 'beta']), createdAt: tick() })
      if (features.length && r.chance(0.4)) {
        const f = r.pick(features)
        const cid = `${f.id}_${c.id}`
        if (!d.comparisons.some((x) => x.id === cid)) d.comparisons.push({ id: cid, featureId: f.id, competitorId: c.id, competitorFeatureId: cf, updatedAt: tick() })
      }
    }

  // Lenses, decks, timelines, documents on a row under the planes.
  const below = new Map<number, number>()
  const place = (canvas: number, w: number, h: number) => {
    const x = below.get(canvas) ?? 0
    below.set(canvas, x + w + 150)
    return { x, y: 2600, w, h, ...(canvasId(canvas) ? { canvasId: canvasId(canvas) } : {}) }
  }
  const STEPS = {
    coverage: [
      { id: 'none', glyph: '○', label: 'none', tone: 'dim' },
      { id: 'partial', glyph: '◐', label: 'partial', tone: 'yellow' },
      { id: 'full', glyph: '●', label: 'full', tone: 'cyan' },
      { id: 'better', glyph: '★', label: 'better', tone: 'magenta' },
    ],
    level: [
      { id: 'low', glyph: '▁', label: 'low', tone: 'dim' },
      { id: 'medium', glyph: '▄', label: 'medium', tone: 'yellow' },
      { id: 'high', glyph: '█', label: 'high', tone: 'magenta' },
    ],
    five: ['one', 'two', 'three', 'four', 'five'].map((l, i) => ({ id: l, glyph: String(i + 1), label: l, tone: i > 2 ? 'cyan' : 'dim' })),
  }
  const featurePlane = s.planes.findIndex((p) => (p.mix.feature ?? 0) > 0)
  const compPlane = s.planes.findIndex((p) => (p.mix.competitor ?? 0) > 0)
  const custPlane = s.planes.findIndex((p) => (p.mix.customer ?? 0) > 0)
  const cellsFor = (mid: string, rows: { key: string }[], cols: { key: string }[], value: () => string | number, fill: number) => {
    for (const row of rows)
      for (const col of cols) {
        if (!r.chance(fill)) continue
        const cell: RawDoc = { id: `${mid}_${row.key}_${col.key}`, matrixId: mid, row: row.key, col: col.key, value: value(), updatedAt: tick() }
        if (r.chance(0.06)) cell.notes = r.pick(W.evidence)
        if (r.chance(0.08)) cell.confidence = r.pick(['inferred', 'guess'])
        if (r.chance(0.03)) ((cell.notRelevant = true), delete cell.value)
        d.cells.push(cell)
      }
  }
  const cardsOnPlane = (i: number, type: string) => (i >= 0 ? (cardsOf.get(planeIds[i]) ?? []).filter((c) => c.type === type) : [])
  for (let m = 0; m < s.matrices; m++) {
    const mid = fid('mtrx', ++n.piece)
    const kind = m % 3
    if (kind === 0) {
      // Features on the feature plane × every competitor, criteria unfolded.
      const fp = planeIds[featurePlane]
      const rowsList = cardsOnPlane(featurePlane, 'feature').map((c) => ({ key: c.id }))
      const colsList = competitors.slice(0, 10).map((c) => ({ key: c.id }))
      // The first matrix shows two features' criteria open (↳ rows, cells read from them, ◇ what nobody meets).
      const judged = d.features.filter((f) => f.pieceId === fp && Array.isArray(f.criteria)).slice(0, m ? 0 : 2)
      d.pieces.push({ id: mid, kind: 'matrix', name: m ? `Coverage ${m + 1}` : 'Feature coverage', ...place(featurePlane >= 0 ? s.planes[featurePlane].canvas : 0, 900, 600), matrix: { rows: { type: 'feature', plane: fp, items: [], unfold: 'criteria', ...(judged.length ? { open: judged.map((f) => f.id) } : {}) }, cols: { type: 'competitor', items: competitors.length > 10 ? [] : [], hide: competitors.slice(10).map((c) => c.id) }, cell: 'scale', steps: STEPS.coverage, notRelevant: true, confidence: true, reading: true }, ...times() })
      cellsFor(mid, rowsList, colsList, () => r.pick(['none', 'partial', 'full', 'full', 'better']), 0.5)
      judged.forEach((f, i) => {
        const crit = f.criteria as { id: string }[]
        // The first criterion of the first one met nowhere (◇ open); the rest scored freely.
        crit.forEach((k, j) => cellsFor(mid, [{ key: `${f.id}~${k.id}` }], colsList, () => (i === 0 && j === 0 ? r.pick(['none', 'partial']) : r.pick(['none', 'partial', 'full'])), 0.7))
      })
    } else if (kind === 1) {
      const rowsList = cardsOnPlane(custPlane, 'problem').slice(0, 14)
      const colsList = cardsOnPlane(custPlane, 'customer').slice(0, 8)
      d.pieces.push({ id: mid, kind: 'matrix', name: m > 1 ? `Pain map ${m}` : 'Pain map', ...place(custPlane >= 0 ? s.planes[custPlane].canvas : 0, 800, 500), matrix: { rows: { type: 'problem', plane: planeIds[custPlane], items: [], hide: cardsOnPlane(custPlane, 'problem').slice(14).map((c) => c.id) }, cols: { type: 'customer', plane: planeIds[custPlane], items: [], hide: cardsOnPlane(custPlane, 'customer').slice(8).map((c) => c.id) }, cell: 'scale', steps: STEPS.level, notRelevant: true, reading: true }, stuckTo: planeIds[custPlane], ...times() })
      cellsFor(mid, rowsList.map((c) => ({ key: c.id })), colsList.map((c) => ({ key: c.id })), () => r.pick(['low', 'medium', 'high']), 0.6)
    } else {
      const picked = r.some(ideas, Math.min(12, ideas.length))
      const crit = ['impact', 'effort', 'confidence', 'reach'].map((name, i) => ({ id: `cr${m}${i}`, name }))
      d.pieces.push({ id: mid, kind: 'matrix', name: `Idea scores ${m}`, ...place(0, 700, 500), matrix: { rows: { items: picked.map((c, i) => ({ id: `it${m}${i}`, cardId: c.id, cardType: 'idea' })) }, cols: { noun: 'criteria', items: crit }, cell: 'scale', steps: STEPS.five, reading: true, totalsAt: 'end' }, ...times() })
      cellsFor(mid, picked.map((c) => ({ key: c.id })), crit.map((c) => ({ key: c.id })), () => r.pick(STEPS.five).id, 0.8)
    }
  }
  for (let t = 0; t < s.tables; t++) {
    const tid = fid('tabl', ++n.piece)
    if (t % 2 === 0) {
      const cols = [
        { id: `tc${t}1`, field: 'status' },
        { id: `tc${t}2`, field: 'priority' },
        { id: `tc${t}3`, field: 'impact' },
        { id: `tc${t}4`, name: 'cost', kind: 'number', unit: '€' },
        { id: `tc${t}5`, name: 'risk', kind: 'scale', steps: STEPS.level },
        { id: `tc${t}6`, name: 'owner', kind: 'text' },
      ]
      d.pieces.push({ id: tid, kind: 'table', name: t ? `Backlog ${t}` : 'Backlog', ...place(featurePlane >= 0 ? s.planes[featurePlane].canvas : 0, 900, 500), table: { rows: { rules: [{ field: 'type', values: ['feature'] }, ...(t ? [{ field: 'status', values: ['planned', 'building'] }] : [])], items: [{ id: `tr${t}`, name: 'Ops work' }] }, cols, sort: { col: `tc${t}4`, desc: true }, pageSize: 25 }, ...times() })
      for (const f of features) {
        if (r.chance(0.5)) d.cells.push({ id: `${tid}_${f.id}_tc${t}4`, matrixId: tid, row: f.id, col: `tc${t}4`, value: r.int(1, 40) * 100, updatedAt: tick() })
        if (r.chance(0.3)) d.cells.push({ id: `${tid}_${f.id}_tc${t}5`, matrixId: tid, row: f.id, col: `tc${t}5`, value: r.pick(['low', 'medium', 'high']), updatedAt: tick() })
        if (r.chance(0.2)) d.cells.push({ id: `${tid}_${f.id}_tc${t}6`, matrixId: tid, row: f.id, col: `tc${t}6`, value: memberName(r.pick(uids)), updatedAt: tick() })
      }
    } else {
      d.pieces.push({ id: tid, kind: 'table', name: `Competitors ${t}`, ...place(compPlane >= 0 ? s.planes[compPlane].canvas : 0, 800, 400), table: { rows: { rules: [{ field: 'type', values: ['competitor'] }], items: [] }, cols: [{ id: `tk${t}1`, field: 'regions' }, { id: `tk${t}2`, field: 'tags' }, { id: `tk${t}3`, name: 'price', kind: 'text' }, { id: `tk${t}4`, name: 'threat', kind: 'scale', steps: STEPS.level }] }, ...(compPlane >= 0 ? { stuckTo: planeIds[compPlane] } : {}), ...times() })
      for (const c of competitors) if (r.chance(0.5)) d.cells.push({ id: `${tid}_${c.id}_tk${t}3`, matrixId: tid, row: c.id, col: `tk${t}3`, value: `${r.int(5, 60)} €/mo`, updatedAt: tick() })
    }
  }
  const deckIds: string[] = []
  for (const ds of s.decks) {
    const did = fid('deck', ++n.piece)
    deckIds.push(did)
    const names = ds.cols ?? ['todo', 'doing', 'review', 'done']
    const cols = names.map((nm, i) => ({ id: `col${i}`, name: nm, ...(i === names.length - 1 ? { done: true } : {}), ...(nm === 'doing' ? { limit: 5 } : {}) }))
    d.pieces.push({ id: did, kind: 'kanban', name: ds.name, ...place(ds.canvas, 1000, 600), kanban: { cols, ...(ds.tasks > 80 ? { rows: 'assignee' } : {}) }, ...(ds.stuckTo !== undefined ? { stuckTo: planeIds[ds.stuckTo] } : {}), ...times() })
    const host = ds.stuckTo !== undefined ? cardsOf.get(planeIds[ds.stuckTo]) ?? [] : allCards
    for (let k = 0; k < ds.tasks; k++) {
      const col = cols[Math.min(cols.length - 1, Math.floor(r.next() * cols.length))]
      const tm = times()
      const t: RawDoc = { id: fid('task', ++n.task), pieceId: did, col: col.id, order: k + 1, title: `${r.pick(W.taskVerbs)} ${r.pick(W.taskObjects)}`, uid: r.pick(uids), ...tm }
      if (r.chance(0.7)) {
        const a = r.pick(uids)
        Object.assign(t, { assignee: a, assigneeName: memberName(a), givenAt: tm.createdAt, givenBy: t.uid })
      }
      if (r.chance(0.6)) t.due = dayStr(NOW + r.int(-20, 40) * DAY)
      if (t.due && r.chance(0.4)) t.start = dayStr(Date.parse(`${t.due}T00:00:00Z`) - r.int(1, 10) * DAY)
      if (r.chance(0.5) && host.length) {
        const c = r.pick(host.filter((x) => x.type !== 'package'))
        if (c) Object.assign(t, { cardId: c.id, cardType: c.type })
      }
      if (r.chance(0.3)) t.priority = r.pick(['P1', 'P2', 'P3'])
      if (r.chance(0.25)) t.labels = r.some(W.tags, 1)
      if (r.chance(0.25)) t.checks = Array.from({ length: r.int(2, 4) }, (_, j) => ({ id: `ch${j}`, text: `${r.pick(W.taskVerbs)} ${r.pick(W.objects)}`, ...(r.chance(0.5) ? { done: true } : {}) }))
      if (r.chance(0.2)) t.notes = r.pick(W.paragraphs)
      d.tasks.push(t)
    }
  }
  if (s.cardDeck) {
    d.pieces.push({
      id: fid('deck', ++n.piece),
      kind: 'kanban',
      name: 'Priorities',
      ...place(featurePlane >= 0 ? s.planes[featurePlane].canvas : 0, 1000, 600),
      kanban: {
        cols: [{ id: 'todo', name: 'todo' }],
        holds: 'cards',
        colField: 'effort',
        rowField: 'impact',
        source: { rules: [{ field: 'type', values: ['feature', 'package'] }], items: [] },
        names: [
          { col: 'S', row: 'high', name: 'quick wins', tone: 'good' },
          { col: 'L', row: 'high', name: 'big bets' },
          { col: 'S', row: 'low', name: 'fill-ins' },
          { col: 'L', row: 'low', name: 'money pits', tone: 'bad' },
        ],
      },
      ...(featurePlane >= 0 ? { stuckTo: planeIds[featurePlane] } : {}),
      ...times(),
    })
  }
  for (let t = 0; t < s.timelines && t < deckIds.length; t++) {
    const deck = d.pieces.find((p) => p.id === deckIds[t])!
    d.pieces.push({ id: fid('time', ++n.piece), kind: 'timeline', name: t ? `Days ${t + 1}` : 'Schedule', ...place((deck.canvasId ? s.canvases.findIndex((_, i) => canvasId(i) === deck.canvasId) : 0) || 0, 1000, 420), stuckTo: deck.id, timeline: { rows: t % 2 ? 'assignee' : 'kanban' }, ...(deck.canvasId ? { canvasId: deck.canvasId } : {}), ...times() })
  }
  // Canvas headings and a section on each canvas.
  s.canvases.forEach((_, i) => {
    d.labels.push({ id: fid('labl', ++n.label), pieceId: 'canvas', size: 'heading', text: r.pick(W.headings), kicker: String(i + 1).padStart(2, '0'), x: 0, y: -300, ...(canvasId(i) ? { canvasId: canvasId(i) } : {}), ...times() })
    d.labels.push({ id: fid('labl', ++n.label), pieceId: 'canvas', kind: 'section', text: 'Working area', x: -50, y: 2500, w: 6000, h: 900, ...(canvasId(i) ? { canvasId: canvasId(i) } : {}), ...times() })
  })
  // A plane also shown on the second canvas.
  if (s.canvases.length > 1) d.pieceSpots.push({ id: `${fid('canv', 1)}_${planeIds[0]}`, canvasId: fid('canv', 1), pieceId: planeIds[0], x: -2500, y: 0, createdAt: tick() })

  // Documents, with their text.
  const documents: ReadWs['documents'] = []
  const bodies: Record<string, DocBody> = {}
  for (let k = 0; k < s.documents; k++) {
    const id = fid('docu', ++n.doc)
    const author = r.pick(uids)
    const titleK = `${W.docTitles[k % W.docTitles.length]}${k >= W.docTitles.length ? ` ${Math.floor(k / W.docTitles.length) + 1}` : ''}`
    const sections = r.some(W.docSections, r.int(3, 6))
    const text = [
      `# ${titleK}`,
      '',
      ...sections.flatMap((sec) => [
        `## ${sec}`,
        '',
        ...Array.from({ length: r.int(1, 3) }, () => `${r.pick(W.paragraphs)} ${r.pick(W.evidence)}.`),
        ...(r.chance(0.5) ? ['', ...Array.from({ length: r.int(2, 4) }, () => `- ${r.pick(W.evidence)}`)] : []),
        '',
      ]),
    ].join('\n')
    const words = text.split(/\s+/).length
    const created = tick()
    documents.push({ id, kind: 'markdown', title: titleK, excerpt: text.split('\n').slice(4, 6).join(' ').slice(0, 200), origin: 'upload', uid: author, name: memberName(author), shared: k % 5 !== 4, contentType: 'text/markdown', size: text.length, words, createdAt: created, updatedAt: r.chance(0.2) ? NOW - r.int(1, 48) * 3_600_000 : created })
    bodies[id] = { text }
  }
  documents.sort((a, b) => b.createdAt - a.createdAt)
  if (s.documents) {
    d.pieces.push({ id: fid('dlst', ++n.piece), kind: 'documents', name: 'Research', ...place(0, 800, 450), documents: { view: 'table' }, ...times() })
    d.pieces.push({ id: fid('dpie', ++n.piece), kind: 'document', ...place(0, 650, 500), docId: documents[documents.length - 1].id, ...times() })
  }

  // Comment threads with their messages.
  const messages: Record<string, MessageInfo[]> = {}
  for (let k = 0; k < s.threads; k++) {
    const c = r.pick(allCards)
    const id = fid('thrd', ++n.thread)
    const who = r.some(s.members, 2)
    const list: MessageInfo[] = Array.from({ length: r.int(1, 4) }, (_, j) => ({ uid: who[j % 2].uid, name: who[j % 2].name, text: r.pick(W.comments), createdAt: tick() }))
    messages[id] = list
    const last = list[list.length - 1]
    d.threads.push({ id, on: 'card', targetId: c.id, planeId: c.plane, x: 0, y: 0, uid: who[0].uid, name: who[0].name, count: list.length, lastAt: last.createdAt, lastUid: last.uid, lastName: last.name, lastText: last.text, ...(r.chance(0.2) ? { resolved: true } : {}), createdAt: list[0].createdAt, updatedAt: last.createdAt })
  }

  for (const c of WS_COLLECTIONS) d[c].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const roles = Object.fromEntries(s.members.map((m) => [m.uid, m.role]))
  return {
    ...fromDocs(d as Docs),
    documents,
    wid: s.wid,
    workspace: { name: s.name, description: s.description, memberIds: s.members.map((m) => m.uid), roles },
    canvas: 'main',
    members: s.members.map(({ uid, name, email }) => ({ uid, name, email })),
    messages,
    bodies,
    me: s.members[0].uid,
    now: NOW,
  }
}

// ---- The three

export function mediumWs(): ReadWs {
  return generate({
    seed: 20261029,
    wid: 'wsPazar0000000000002',
    name: 'Pazar',
    description: 'Pre-orders from neighbourhood market stalls, picked up on the way home',
    theme: PAZAR,
    members: [
      { uid: 'u-ayse', name: 'Ayşe Demir', email: 'ayse@pazar.example', role: 'owner' },
      { uid: 'u-jonas', name: 'Jonas Weber', email: 'jonas@pazar.example', role: 'editor' },
      { uid: 'u-mert', name: 'Mert Kaya', email: 'mert@pazar.example', role: 'editor' },
      { uid: 'u-lea', name: 'Lea Hoffmann', email: 'lea@pazar.example', role: 'viewer' },
    ],
    canvases: ['Discovery', 'Build'],
    planes: [
      { name: 'Segments', canvas: 0, mix: { customer: 14, problem: 16 } },
      { name: 'Rivals', canvas: 0, mix: { competitor: 14, problem: 4 } },
      { name: 'Bets', canvas: 0, mix: { idea: 22, problem: 6 } },
      { name: 'Roadmap', canvas: 1, mix: { feature: 30 }, packages: 2 },
      { name: 'Pricing', canvas: 1, mix: { customer: 4, idea: 8, feature: 8 } },
      { name: 'Interviews', canvas: 0, mix: { customer: 10, problem: 10 } },
    ],
    links: 260,
    matrices: 2,
    tables: 1,
    decks: [
      { name: 'Sprint', canvas: 1, tasks: 40, stuckTo: 3 },
      { name: 'Research', canvas: 0, tasks: 20 },
    ],
    cardDeck: true,
    timelines: 1,
    stickies: 12,
    documents: 4,
    threads: 8,
    places: 6,
  })
}

export function bigWs(): ReadWs {
  const planes: PlaneSpec[] = [
    { name: 'Segments', canvas: 0, mix: { customer: 60, problem: 40 } },
    { name: 'Pains', canvas: 0, mix: { problem: 100 } },
    { name: 'Interviews DE', canvas: 0, mix: { customer: 50, problem: 50 } },
    { name: 'Interviews FR', canvas: 0, mix: { customer: 50, problem: 50 } },
    { name: 'Rivals', canvas: 0, mix: { competitor: 70, problem: 30 } },
    { name: 'Accountants', canvas: 0, mix: { customer: 40, problem: 40, competitor: 20 } },
    { name: 'Bets', canvas: 1, mix: { idea: 100 } },
    { name: 'Experiments', canvas: 1, mix: { idea: 60, problem: 40 } },
    { name: 'Pricing', canvas: 1, mix: { customer: 30, idea: 40, feature: 30 } },
    { name: 'Channels', canvas: 1, mix: { customer: 40, idea: 60 } },
    { name: 'Roadmap', canvas: 2, mix: { feature: 100 }, packages: 4 },
    { name: 'Mobile', canvas: 2, mix: { feature: 100 }, packages: 2 },
    { name: 'Integrations', canvas: 2, mix: { feature: 80, competitor: 20 }, packages: 2 },
    { name: 'Tax engine', canvas: 2, mix: { feature: 100 }, packages: 3 },
    { name: 'Risks', canvas: 2, mix: { problem: 60, idea: 40 } },
  ]
  return generate({
    seed: 7151500,
    wid: 'wsLedgerly0000000003',
    name: 'Ledgerly',
    description: 'Bookkeeping and tax for freelancers across Europe, so they never think about VAT again',
    theme: LEDGER,
    members: [
      { uid: 'u-lena', name: 'Lena Fischer', email: 'lena@ledgerly.example', role: 'owner' },
      { uid: 'u-omar', name: 'Omar Haddad', email: 'omar@ledgerly.example', role: 'owner' },
      { uid: 'u-claire', name: 'Claire Martin', email: 'claire@ledgerly.example', role: 'editor' },
      { uid: 'u-tobias', name: 'Tobias Braun', email: 'tobias@ledgerly.example', role: 'editor' },
      { uid: 'u-sofia', name: 'Sofia Rossi', email: 'sofia@ledgerly.example', role: 'editor' },
      { uid: 'u-ben', name: 'Ben Okafor', email: 'ben@ledgerly.example', role: 'viewer' },
    ],
    canvases: ['Discovery', 'Strategy', 'Product'],
    planes,
    links: 3000,
    matrices: 4,
    tables: 3,
    decks: [
      { name: 'Sprint 14', canvas: 2, tasks: 140, stuckTo: 10 },
      { name: 'Mobile sprint', canvas: 2, tasks: 90, stuckTo: 11 },
      { name: 'Research', canvas: 0, tasks: 90 },
      { name: 'Go to market', canvas: 1, tasks: 80, cols: ['backlog', 'this week', 'doing', 'done'] },
    ],
    cardDeck: true,
    timelines: 2,
    stickies: 150,
    documents: 20,
    threads: 40,
    places: 40,
  })
}

// The café fixture (ws.ts) with every piece kind: its matrix and table (lensDocs), the extra decks, timeline and tasks
// (taskDocs), a section and a second canvas (textWs), plus a documents list, a document, a thread and the people list.
export function smallWs(): ReadWs {
  const d = lensDocs()
  const t = taskDocs()
  const have = new Set(d.pieces.map((p) => p.id))
  d.pieces.push(...t.pieces.filter((p) => !have.has(p.id)))
  const tasks = new Set(d.tasks.map((x) => x.id))
  d.tasks.push(...t.tasks.filter((x) => !tasks.has(x.id)))
  d.labels.push(
    { id: SEC.plane, pieceId: ID.planeA, text: 'Ideas', kind: 'section', x: 525, y: 0, w: 450, h: 375, createdAt: T + 1, updatedAt: T + 1 },
    { id: 'labl0000000000000020', pieceId: 'canvas', kind: 'title', text: '', x: -800, y: -700, createdAt: T + 2 },
  )
  d.canvases.push({ id: SEC.canvas2, name: 'Engineering', order: 1, createdAt: T })
  d.pieceSpots.push({ id: `${SEC.canvas2}_${ID.planeB}`, canvasId: SEC.canvas2, pieceId: ID.planeB, x: 0, y: 0, createdAt: T })
  d.pieces.push(
    { id: 'dlst0000000000000008', kind: 'documents', x: 2200, y: 600, w: 800, h: 450, name: 'Research', documents: { view: 'table' }, createdAt: T + 3, updatedAt: T + 3 },
    { id: 'dpie0000000000000009', kind: 'document', x: 3100, y: 600, w: 650, h: 500, docId: 'docu0000000000000001', createdAt: T + 4, updatedAt: T + 4 },
  )
  d.threads.push({ id: 'thrd0000000000000001', on: 'card', targetId: ID.queue, planeId: ID.planeA, x: 0, y: 0, uid: 'u-bob', name: 'Bob', count: 2, lastAt: T + 600_000, lastUid: 'u-alice', lastName: 'Alice', lastText: 'Yes, three cafés said so.', createdAt: T + 300_000, updatedAt: T + 600_000 })
  for (const c of WS_COLLECTIONS) d[c].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const text = '# Interview notes — Anna\n\n## Summary\n\nAnna runs two cafés and loses orders every morning.\n\n## Quotes\n\n- "People leave when the queue reaches the door."\n- "I would pay for pre-orders if it is not another tablet."\n\n## Next steps\n\nVisit on a Sunday.'
  return {
    ...fromDocs(d),
    documents: [{ id: 'docu0000000000000001', kind: 'markdown', title: 'Interview notes — Anna', excerpt: 'Anna runs two cafés and loses orders every morning.', origin: 'upload', uid: 'u-alice', name: 'Alice', shared: true, contentType: 'text/markdown', size: text.length, words: 50, createdAt: T + 5, updatedAt: T + 5 }],
    bodies: { docu0000000000000001: { text } },
    wid: WID,
    workspace: { name: WORKSPACE.name, description: WORKSPACE.description, memberIds: WORKSPACE.memberIds, roles: WORKSPACE.roles },
    canvas: 'main',
    members: [
      { uid: 'u-alice', name: 'Alice', email: 'alice@example.com' },
      { uid: 'u-bob', name: 'Bob', email: 'bob@example.com' },
      { uid: 'u-carol', name: 'Carol', email: 'carol@example.com' },
    ],
    messages: {
      thrd0000000000000001: [
        { uid: 'u-bob', name: 'Bob', text: 'Is this validated by more than Anna?', createdAt: T + 300_000 },
        { uid: 'u-alice', name: 'Alice', text: 'Yes, three cafés said so.', createdAt: T + 600_000 },
      ],
    },
    me: 'u-alice',
    now: NOW,
  }
}

export { LENS, TASKS }
