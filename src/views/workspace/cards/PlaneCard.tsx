// A card on a plane (D-187, D-205, D-358): its face, on the card face (CardFace's `card` edge, tinted in its type), and
// what's inside it by how big it is on screen (D-153): `full` the type and, right of it, a status, regions or priority
// with the evidence as cells; the title; the facts line; tags as chips. `compact` the title alone, bigger, in whole
// words; `far` its lines as bars. Inside (D-225, D-245): an open competitor's features as small cards by category (a
// strip of cells while closed), a folded card's or package's members as rows, `+ 3 parts` to fold or unfold. Its place,
// drag, link handle, marks and landing are the plane's (PlaneCards.tsx); this is what it looks like.
// Also the unfolded package's band (D-239): the same face, a line tall, its name, rating, a cell per member, `− N`.
import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type Ref } from 'react'
import { WORLD } from '../../../model/world'
import { CARD, type Card } from '../../../data/cards'
import type { CompetitorFeature } from '../../../data/competitorFeatures'
import { byCategory, INDENT } from '../plane/cardInside'
import type { Facts, Proof } from '../plane/cardFacts'
import { CARD_TONE } from '../../../ui/foundation/cardTone'
import { Chip } from '../../../ui/primitives/Chip'
import { cardPlaceholder } from '../../../model/cardName'
import { CardFace } from './CardFace'
import { Progress } from './Progress'
import { CardRow } from './CardRow'
import styles from './PlaneCard.module.css'

// How much of it shows, by its size on screen (PlaneCards.tsx picks it, D-111, D-153).
export type Detail = 'full' | 'compact' | 'far'
// Evidence cells, up to this many each way (D-152).
const MOST = 5
// The full title: up to 80 characters, three lines (two with tags under it).
const TITLE_SHOWN = 80

// What its insides do (the plane says what): a competitor's feature opened, a member's row picked, its parts folded.
type Acts = {
  onFeature?: (f: CompetitorFeature) => void
  onMember?: (c: Card) => void
  onFold?: () => void
}

type Props = {
  card: Card
  facts?: Facts
  detail: Detail
  editor: boolean
  parts: number
  rows?: { card: Card; depth: number }[]
  inPkg?: Map<string, number>
  features?: CompetitorFeature[]
  matched: Set<string>
  open: boolean
  // The plane's class (where it sits in its box, how it goes small while dragged) and the drag's inline transform.
  className?: string
  style?: CSSProperties
  ref?: Ref<HTMLDivElement>
} & Acts

export function PlaneCard({ card, facts, detail, editor, parts, rows, inPkg, features, matched, open, className, style, ref, onFeature, onMember, onFold }: Props) {
  return (
    <CardFace ref={ref} className={[styles.card, className].filter(Boolean).join(' ')} style={style} tone={CARD_TONE[card.type]} tint edge="card" data-detail={detail} data-type={card.type}>
      {detail === 'full' ? (
        <FullCard card={card} facts={facts} editor={editor} parts={parts} rows={rows} inPkg={inPkg} features={features} matched={matched} open={open} onFeature={onFeature} onMember={onMember} onFold={onFold} />
      ) : (
        <CompactTitle text={card.title || cardPlaceholder(card.type)} empty={!card.title} bars={detail === 'far'} />
      )}
    </CardFace>
  )
}

type BandProps = {
  card: Card
  facts?: Facts
  members: Card[]
  editor: boolean
  onFold: () => void
  className?: string
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
} & Record<`data-${string}`, string | undefined>

// An unfolded package's band (D-239): it is the package (select, drag them all, its `›`); its name, its rating, a cell
// per member in their colours, `− N` to fold them in.
export function PackageBand({ card, facts, members, editor, onFold, className, onPointerDown, onPointerEnter, onPointerLeave, ...data }: BandProps) {
  return (
    <CardFace {...data} className={[styles.band, className].filter(Boolean).join(' ')} tone={CARD_TONE.package} tint edge="card" onPointerDown={onPointerDown} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <span className={styles.kind}>package</span>
      <span className={styles.bandName} data-empty={!card.title || undefined}>
        {card.title || cardPlaceholder('package')}
      </span>
      {facts?.head && <span className={styles.bandFacts}>{facts.head}</span>}
      <span className={styles.cells}>
        {members.slice(0, 12).map((m) => (
          <i key={m.id} data-on style={{ background: CARD_TONE[m.type] }} />
        ))}
      </span>
      {editor && (
        <button /* kit-ok: on the package's band at the world's size: the Button's cell drawn in world units (D-344) */ className={styles.fold} onPointerDown={(e) => e.stopPropagation()} onClick={onFold} title="Fold its members into it">
          − {members.length}
        </button>
      )}
    </CardFace>
  )
}

type FullProps = {
  card: Card
  facts?: Facts
  editor: boolean
  parts: number
  rows?: { card: Card; depth: number }[]
  inPkg?: Map<string, number>
  features?: CompetitorFeature[]
  matched: Set<string>
  open: boolean
} & Acts

function FullCard({ card, facts, editor, parts, rows, inPkg, features, matched, open, onFeature, onMember, onFold }: FullProps) {
  const tags = card.tags ?? []
  const inside = !!rows || open
  const groups = open && features?.length ? byCategory(features) : null
  const ours = features?.filter((f) => matched.has(f.id)).length ?? 0
  const title = card.title.length > TITLE_SHOWN ? `${card.title.slice(0, TITLE_SHOWN - 1).trimEnd()}…` : card.title
  const head = facts?.head && facts.head.length > 24 ? `${facts.head.slice(0, 23)}…` : facts?.head
  return (
    <>
      <span className={styles.head}>
        <span className={styles.kind}>{card.type}</span>
        {head && (
          <span className={styles.status} data-clash={facts?.clash || undefined}>
            {head}
          </span>
        )}
        {facts?.proof && <ProofCells proof={facts.proof} />}
      </span>
      <p className={styles.title} data-empty={!card.title || undefined} data-lines={inside || tags.length ? 2 : 3} data-inside={inside || undefined}>
        {title || cardPlaceholder(card.type)}
      </p>
      {groups && (
        <div className={styles.inner}>
          {groups.map((g) => (
            <div key={g.cat || '-'}>
              {g.cat && (
                <p className={styles.innerCat}>
                  {g.cat} <span>{g.items.length}</span>
                </p>
              )}
              {g.items.map((f) => (
                <CardRow
                  key={f.id}
                  className={styles.mini}
                  size="world"
                  wash
                  // Cyan when it matches one of ours.
                  tone={matched.has(f.id) ? 'var(--accent-cyan)' : CARD_TONE[card.type]}
                  data-match={matched.has(f.id) || undefined}
                  onClick={() => onFeature?.(f)}
                  title={f.name}
                  end={<span className={styles.miniAv}>{f.availability}</span>}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      {rows && (
        <div className={styles.inner}>
          {rows.map((r) => {
            // What a folded card holds (D-245): each row a bar in its own card's colour, a step further in for each level
            // down, so what's under what shows; its status or priority; a package's row, how much it holds.
            const held = r.card.type === 'package' ? (inPkg?.get(r.card.id) ?? 0) : 0
            return (
              <CardRow
                key={r.card.id}
                className={styles.memberRow}
                titleClass={styles.miniName}
                size="world"
                style={{ ['--tone' as string]: CARD_TONE[r.card.type], paddingLeft: r.depth * INDENT }}
                onClick={() => onMember?.(r.card)}
                lead={<i aria-hidden />}
                title={r.card.title || cardPlaceholder(r.card.type)}
                empty={!r.card.title}
                end={<span className={styles.miniAv}>{[held ? `${held} inside` : '', r.card.status ?? r.card.validation ?? r.card.priority].filter(Boolean).join(' · ')}</span>}
              />
            )
          })}
        </div>
      )}
      {!open && features && features.length > 0 && (
        <span className={styles.strip} aria-label={`${features.length} features, ${ours} match ours`}>
          <span className={styles.cells}>
            {byCategory(features)
              .flatMap((g) => g.items)
              .slice(0, 12)
              .map((f) => (
                <i key={f.id} data-match={matched.has(f.id) || undefined} />
              ))}
          </span>
          {features.length} features{ours ? ` · ${ours} ≈ ours` : ''}
        </span>
      )}
      <span className={styles.foot}>
        {facts?.meta && <span className={styles.facts}>{facts.meta}</span>}
        {facts?.tasks && <Progress className={styles.tasks} look="box" done={facts.tasks.done} all={facts.tasks.all} title={`${facts.tasks.done} of ${facts.tasks.all} tasks finished`} />}
        {/* On other planes too (D-281): what's changed here changes there. */}
        {facts?.planes && (
          <span className={styles.planes} title={`On ${facts.planes} planes: the same card on each`}>
            ⧉ <b>{facts.planes}</b>
          </span>
        )}
        {parts > 0 && (
          <button /* kit-ok: a card face's `+ N parts`, at the world's size: the Button's cell drawn in world units (D-344) */
            className={styles.fold}
            disabled={!editor}
            title={card.type === 'package' ? 'Lay what it holds out on the plane' : card.folded ? 'Unfold its parts onto the plane' : 'Fold its parts into it'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onFold}
          >
            {card.type === 'package' ? `+ ${parts} inside` : `${card.folded ? '+' : '−'} ${parts} part${parts === 1 ? '' : 's'}`}
          </button>
        )}
      </span>
      {tags.length > 0 && !inside && <TagChips tags={tags} />}
    </>
  )
}

// Evidence as cells: filled for each piece that supports it, outlined for each against; magenta when the evidence and
// the status disagree.
function ProofCells({ proof }: { proof: Proof }) {
  const cells = [...Array<boolean>(Math.min(MOST, proof.supports)).fill(true), ...Array<boolean>(Math.min(MOST, proof.contradicts)).fill(false)]
  return (
    <span className={styles.proof} data-clash={proof.clash || undefined} aria-label={`${proof.supports} for, ${proof.contradicts} against`}>
      {cells.map((filled, i) => (
        <i key={i} data-filled={filled || undefined} />
      ))}
    </span>
  )
}

// Tags as framed chips in a row (the kit's Chip at the world's size, D-326); what doesn't fit becomes `+N`. Mono is
// 0.6 em a character. The same sizes as the CSS (D-325): --w-text-2xs (WORLD.smallText), --space-1, and the world's chip gap and card
// padding (model/world.ts).
const CHIP_TEXT = WORLD.smallText
const CHIP_PAD = 4
const CHIP_GAP = WORLD.chipGap
const CHIP_ROOM = CARD.w - 2 * WORLD.cardPad - WORLD.cardEdge
const chipWidth = (text: string) => text.length * CHIP_TEXT * 0.6 + CHIP_PAD * 2
function TagChips({ tags }: { tags: string[] }) {
  const shown: string[] = []
  let x = 0
  for (let i = 0; i < tags.length; i++) {
    const text = `#${tags[i]}`
    // Room for the `+N` chip unless this is the last tag.
    const need = chipWidth(text) + (i < tags.length - 1 ? CHIP_GAP + chipWidth(`+${tags.length - i - 1}`) : 0)
    if (x + need > CHIP_ROOM) {
      shown.push(`+${tags.length - i}`)
      break
    }
    shown.push(text)
    x += chipWidth(text) + CHIP_GAP
  }
  return (
    <span className={styles.tags}>
      {shown.map((t) => (
        <Chip key={t} scale="world">
          {t}
        </Chip>
      ))}
    </span>
  )
}

// Zoomed out (D-153): the title alone at one size, at most three lines, ending at the last whole word that fits with
// `…`; far out, each line a bar as long as the line.
function CompactTitle({ text, empty, bars }: { text: string; empty: boolean; bars: boolean }) {
  const el = useRef<HTMLParagraphElement>(null)
  const [cut, setCut] = useState<{ of: string; text: string } | null>(null)
  useLayoutEffect(() => {
    const p = el.current
    if (!p) return
    const fits = () => p.scrollHeight <= p.clientHeight + 1
    const words = text.split(/\s+/)
    const span = p.firstElementChild as HTMLElement
    span.textContent = text
    if (fits()) return setCut(null)
    // The most whole words that fit with the `…`; a single long word is cut short instead.
    let lo = 0
    let hi = words.length - 1
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      span.textContent = `${words.slice(0, mid).join(' ')}…`
      if (fits()) lo = mid
      else hi = mid - 1
    }
    let shown = lo > 0 ? `${words.slice(0, lo).join(' ')}…` : text
    if (lo === 0)
      for (let n = text.length - 1; n > 0; n--) {
        span.textContent = `${text.slice(0, n)}…`
        if (fits()) {
          shown = span.textContent
          break
        }
      }
    span.textContent = shown
    setCut({ of: text, text: shown })
  }, [text])
  return (
    <p ref={el} className={styles.compact} data-empty={empty || undefined} data-bars={bars || undefined}>
      <span>{cut?.of === text ? cut.text : text}</span>
    </p>
  )
}
