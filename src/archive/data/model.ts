// Firestore data model: the logical model from docs/ARCHITECTURE.md §5.
//
//   workspaces/{workspaceId}                 Workspace
//     customers/{id}                         Customer (D-042, D-044)
//     problems/{id}                          Problem (D-041)
//     ideas/{id}                             Idea
//     labels/{id}                            Label: text on the board, a place to jump to (D-050)
//     features/{id}                          Feature
//     competitors/{id}                       Competitor
//     competitorFeatures/{id}                CompetitorFeature
//     comparisons/{id}                       Comparison
//     edges/{id}                             Edge (any node ↔ any node)
//     attachments/{id}                       Attachment (D-083); the file is in Storage at `path`
//     reports/{id}                           ReportSummary (D-090, D-098): a report's title, answer and counts
//       content/body                         ReportBody (D-098): its sections and sources, fetched when it's opened
//     members/{uid}                          Member (D-098): a member's name and email, for the people list
//   inviteCodes/{code}                       InviteCode (D-012)
//   joinRequests/{workspaceId}_{uid}         JoinRequest (D-062)
//
// Realtime Database (ephemeral):
//   presence/{workspaceId}/{uid}             Presence (D-016)

// D-098: any number of owners (never none), editors, and viewers who read but don't change the workspace.
export type Role = 'owner' | 'editor' | 'viewer'
export const ROLES: readonly Role[] = ['owner', 'editor', 'viewer']

export type Workspace = {
  name: string
  // What the team is building (D-082), for people and the assistant.
  description?: string
  // Who created it. Authority comes from `roles` (D-098); this never changes.
  ownerId: string
  memberIds: string[]
  roles: Record<string, Role>
  inviteCode: string
  // Lowercased addresses the owner invited; accepting or declining removes yours (D-062).
  invitedEmails?: string[]
  // Retired (D-062): codes used to join directly. Older workspaces may still carry it.
  joinCode?: string
  createdAt: number
}

export type InviteCode = {
  workspaceId: string
  createdBy: string
}

// Someone entered the code and waits for the owner (D-062).
export type JoinRequest = {
  workspaceId: string
  // The workspace's creator when it was asked (unused since D-098: owners query by workspace).
  ownerId: string
  uid: string
  name: string
  email: string
  code: string
  createdAt: number
}

export type NodeType = 'customer' | 'problem' | 'idea' | 'feature' | 'competitor' | 'competitorFeature' | 'package'

// Node types that live on the board as cards (D-040), in the order of the chain (D-045); packages (D-141) after it, as
// they bundle a piece of it.
export const BOARD_TYPES = ['customer', 'problem', 'competitor', 'idea', 'feature', 'package'] as const
export type BoardType = (typeof BOARD_TYPES)[number]
// What + makes: every card but a package, which is made from a selection.
export const MADE_TYPES = BOARD_TYPES.filter((t): t is Exclude<BoardType, 'package'> => t !== 'package')

// Fields shared by every board card.
export type BoardNode = {
  title: string
  body?: string
  // Retired (D-055): colour now means the card's type. Older cards may still carry it; it's ignored.
  color?: string
  tags?: string[]
  x: number
  y: number
  z?: number
  createdAt: number
  updatedAt: number
}

// Who it's for, at any breadth; also the segment (D-044). Items are tagged with `for` edges.
// How far a customer, problem or idea is from a guess (D-137): set by hand; its evidence informs it.
export const VALIDATIONS = ['hypothesis', 'testing', 'validated', 'invalidated'] as const
export type Validation = (typeof VALIDATIONS)[number]

export type Customer = BoardNode & { validation?: Validation }

export type Problem = BoardNode & { validation?: Validation }

export type Idea = BoardNode & {
  status?: string
  validation?: Validation
}

// A board of its own in the workspace (D-139): the same cards, placed where this plane wants them. All, the plane every
// workspace has, has no doc: its id is `all` and a card's own x/y are its place there.
export type Plane = {
  name: string
  order: number
  createdAt: number
  updatedAt: number
}

// Something placed on the workspace's canvas (D-174, D-176): for now a board. World units are canvas pixels at zoom 1;
// x/y is its top-left corner.
export type PieceKind = 'board'
export type Piece = {
  kind: PieceKind
  x: number
  y: number
  w: number
  h: number
  name?: string
  createdAt: number
  updatedAt: number
}

// Where a card sits on a plane other than All (D-139). Doc id `${planeId}_${itemId}`, so it's there once at most.
export type Placement = {
  planeId: string
  itemId: string
  itemType: BoardType
  x: number
  y: number
  // Its parts folded into it on this plane (D-164); only `true` is stored.
  folded?: boolean
}

// A piece of the chain made one card (D-139, D-141): a problem, the idea that solves it, its features. On its home plane
// its members are laid out inside its frame; anywhere else it's one card that links and is rated like a feature.
// Members that no longer exist are skipped (so undoing a card's delete puts it back in).
export const MAX_MEMBERS = 60
export type Package = BoardNode & {
  memberIds: string[]
  homePlaneId: string
  impact?: (typeof FEATURE_IMPACTS)[number]
  effort?: (typeof FEATURE_EFFORTS)[number]
}

// What was learned, on a customer, problem or idea (D-137): listed in its panel, counted on its card.
export const EVIDENCE_TYPES = ['customer', 'problem', 'idea'] as const
export type EvidenceType = (typeof EVIDENCE_TYPES)[number]
export const EVIDENCE_KINDS = ['interview', 'quote', 'data', 'observation', 'link'] as const
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]
export const STANCES = ['supports', 'contradicts'] as const
export type Stance = (typeof STANCES)[number]

export type Evidence = {
  nodeId: string
  nodeType: EvidenceType
  kind: EvidenceKind
  // What was learned, in a sentence or a quote.
  text: string
  stance: Stance
  // Who or where it came from ("Anna, café owner").
  source?: string
  url?: string
  // When it was learned, `YYYY-MM-DD`.
  date?: string
  createdAt: number
  updatedAt: number
}

// Text written on the board (D-050). Headings and subheadings are places you can jump to; notes aren't (D-116).
// How big text on the board is (D-108): an area's heading (the default), a subheading, a minor heading (H3, D-130),
// or a paragraph (`note`, D-156: wraps at `w`, light Markdown). A section's name takes the first three.
export const LABEL_SIZES = ['heading', 'subheading', 'minor', 'note'] as const
export type LabelSize = (typeof LABEL_SIZES)[number]
// A label's kind: plain text (none), the project's title block (D-118), which shows the workspace's name and
// description instead of its own text (one per board), a section (D-130): a named frame round part of the board,
// `w` × `h` centred on x/y, holding whatever lies inside it (cards, text, smaller sections), or a sticky note (D-158),
// `w` wide, signed by who wrote it.
export type LabelKind = 'title' | 'section' | 'sticky'
// Turned a quarter (D-156): 90 reads bottom to top, -90 top to bottom.
export const LABEL_TURNS = [90, -90] as const
export type LabelTurn = (typeof LABEL_TURNS)[number]
// How long text may be: a heading or a section's name, and a paragraph or a sticky note (D-156).
export const LABEL_TEXT_MAX = 200
export const LONG_TEXT_MAX = 4000
export const KICKER_MAX = 60
// A paragraph's text sizes (D-160, D-161); large is the default and isn't stored (an old stored `large` reads the same).
export const PARAGRAPH_SCALES = ['small', 'medium', 'large'] as const
export type ParagraphScale = (typeof PARAGRAPH_SCALES)[number]

export type Label = {
  text: string
  // The plane it's written on (D-139); missing = All.
  planeId?: string
  color?: string
  size?: LabelSize
  kind?: LabelKind
  // How it's set (D-130): only `true` is stored.
  bold?: boolean
  italic?: boolean
  caps?: boolean
  // Text and a section's name turned a quarter (D-156); missing = level.
  rotate?: LabelTurn
  // A heading's or a section's small line before it (D-156), `02 who we beat`: a leading number in the accent.
  kicker?: string
  // A paragraph's text size (D-160): small, medium (missing) or large.
  scale?: ParagraphScale
  // Where a section's name sits in its frame (D-157): the top edge (missing) or up the left edge.
  side?: 'left'
  // A sticky note's writer (D-158), as they were named when they wrote it.
  uid?: string
  author?: string
  x: number
  y: number
  // A section's size (D-130); the title block's width when resized (D-132), its height following its text; a
  // paragraph's or sticky note's width (D-156, D-158).
  w?: number
  h?: number
  createdAt: number
  updatedAt: number
}

export const FEATURE_PRIORITIES = ['P1', 'P2', 'P3'] as const
export const FEATURE_STATUSES = ['idea', 'planned', 'building', 'shipped'] as const
export const FEATURE_EFFORTS = ['S', 'M', 'L'] as const
// How much it would move things for the customer (D-138); with effort and the chain's confidence, it ranks features.
export const FEATURE_IMPACTS = ['low', 'medium', 'high'] as const

// What a feature must do to count (D-133): the matrix scores each competitor against these, so a partial cell says
// which part. The id is the feature's own (it outlives renames and survives an import unchanged).
export type Criterion = { id: string; text: string }
export const MAX_CRITERIA = 8

export type Feature = BoardNode & {
  priority?: (typeof FEATURE_PRIORITIES)[number]
  status?: (typeof FEATURE_STATUSES)[number]
  effort?: (typeof FEATURE_EFFORTS)[number]
  impact?: (typeof FEATURE_IMPACTS)[number]
  criteria?: Criterion[]
  // Its parts (features linked to it with `part of`) folded into it on All, shown as names beside it (D-164); only
  // `true` is stored. On another plane it's the placement's.
  folded?: boolean
}

// Competitors are named, not titled; on the board since D-040 (no position yet = placed on first view).
export type Competitor = {
  name: string
  // Grouping within competitors, like every other card (D-056).
  tags?: string[]
  // Where it operates (D-145): place names like `US`, `Germany`, `Europe` (src/views/competitors/regions.ts).
  regions?: string[]
  url?: string
  description?: string
  pricing?: string
  audience?: string
  notes?: string
  color?: string
  x?: number
  y?: number
  createdAt: number
  updatedAt: number
}

// How a competitor offers one of its features (D-164).
export const AVAILABILITIES = ['free', 'paid', 'enterprise', 'beta'] as const
export type Availability = (typeof AVAILABILITIES)[number]

// Listed on its competitor's page, grouped by category (D-038); named beside its card on the board (D-164). Which of
// our features it matches is the matrix cell's `competitorFeatureId`, not a field here.
export type CompetitorFeature = {
  competitorId: string
  name: string
  description?: string
  category?: string
  availability?: Availability
  // Where it was seen.
  url?: string
  createdAt: number
  updatedAt: number
}

export const COVERAGES = ['none', 'partial', 'full', 'better'] as const
export type Coverage = (typeof COVERAGES)[number]

// How sure a cell is (D-136): their docs say so, read between the lines, or a guess. Missing = not said.
export const CONFIDENCES = ['documented', 'inferred', 'guess'] as const
export type Confidence = (typeof CONFIDENCES)[number]

// How a competitor does on one of the feature's criteria (D-133); missing = not assessed.
export const CRITERION_SCORES = ['met', 'part', 'no'] as const
export type CriterionScore = (typeof CRITERION_SCORES)[number]

// One matrix cell. Doc id is `${featureId}_${competitorId}`, so a cell can't be created twice.
export type Comparison = {
  featureId: string
  competitorId: string
  // Missing = not assessed yet. Once any criterion is scored, the scores decide what the cell reads (D-133).
  coverage?: Coverage
  // Criterion id → score. A removed criterion's score goes with it.
  criteria?: Record<string, CriterionScore>
  // The competitor isn't comparable on this feature at all (D-136): left out of the row's reading and the counts, unlike
  // `none` (they could, and don't). Only `true` is stored.
  notRelevant?: boolean
  confidence?: Confidence
  notes?: string
  competitorFeatureId?: string
  updatedAt: number
}

// `for` tags an item with a customer (D-044): drawn as a label on the card, not a line.
export const FOR = 'for'
export type EdgeKind =
  | 'relates'
  | 'depends-on'
  | 'contradicts'
  | 'part-of'
  | 'inspired-by'
  | 'solves'
  | 'competes-with'
  | typeof FOR
  | (string & {})

export type Edge = {
  fromId: string
  fromType: NodeType
  toId: string
  toType: NodeType
  kind: EdgeKind
  label?: string
  // Bend points the user put on it (D-155), in order from `from` to `to`; absent, it's straight.
  bends?: Bend[]
}

// A bend point, relative to the middle between the centres of the two cards a link joins: moved together, the cards keep
// its shape; turned around, the same points in reverse order.
export type Bend = { x: number; y: number }
export const MAX_BENDS = 8

// Images, SVGs and PDFs on an item (D-083). The same list is in firestore.rules and storage.rules.
export const ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf'] as const
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number]
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

export type Attachment = {
  nodeId: string
  nodeType: NodeType
  // What the person called it (shown); the stored file name is the last part of `path`.
  name: string
  contentType: AttachmentType
  size: number
  // workspaces/{wid}/attachments/{id}/{safe name}
  path: string
  // Images only.
  width?: number
  height?: number
  // Images only: a small WebP beside the file (`<id>/~thumb.webp`) that the panel shows; the full file loads on click.
  thumbPath?: string
  // Who attached it.
  uid: string
  createdAt: number
}

// A research report (D-089), saved when it's written (D-090). Only its author sees it until they share it with the
// workspace. The same limits are in firestore.rules.
export type ReportPoint = { text: string; sources: number[] }
export type ReportContent = {
  title: string
  answer: string
  sections: { question: string; points: ReportPoint[] }[]
  // `items`: ids of our items it concerns.
  implications: { text: string; items: string[] }[]
  openQuestions: string[]
  // Numbered from 1: a point's `sources` index into this.
  sources: { title: string; url: string }[]
}

// `research`: from /research (D-088), points without sources are inferences. `chat`: the assistant wrote up a
// conversation when asked (D-090). `upload`: someone's own .md file (D-091). Older reports have no kind and are research.
export type ReportKind = 'research' | 'chat' | 'upload'

type ReportMeta = {
  kind?: ReportKind
  topic: string
  // Who ran it and their name then.
  uid: string
  name: string
  model: string
  shared: boolean
  createdAt: number
}

// What a report's list row needs (D-098): small, so the reports tab can list many. Its body is a doc of its own.
// Reports saved before D-098 are one doc holding everything (sections etc. inline, no counts); both shapes are read.
export type ReportSummary = ReportMeta & {
  title: string
  answer: string
  sectionCount?: number
  sourceCount?: number
} & Partial<ReportBody>

export type ReportBody = Pick<ReportContent, 'sections' | 'implications' | 'openQuestions' | 'sources'>

// A whole report, as the report screen, export and the chat use it.
export type SavedReport = ReportContent & ReportMeta

// A member of a workspace as the people list shows them (D-098). Written by the member when they open it, or by an
// owner who lets them in. Their role is on the workspace (`roles`), not here.
export type Member = {
  name: string
  email?: string
  photo?: string
  joinedAt: number
}

// Uploaded files (D-091) can be longer than what the assistant writes, so these leave room.
export const REPORT_LIMITS = { sections: 30, points: 40, implications: 20, openQuestions: 30, sources: 200, text: 4000 }

export type Presence = {
  name: string
  color: string
  view: string
  x?: number
  y?: number
  ts: number
}

// A comment thread (D-159): a conversation pinned to something on the board (a card, text, a section, a sticky note,
// a link) or to a spot on it. Any member may start one or answer, viewers too; it's not content, so it's not undone,
// copied, exported or filtered. `x`/`y` is where it was pinned (a spot's place, or the thing's when the thread began),
// used when the thing is gone. `count` and `lastAt` follow its messages.
export const THREAD_TARGETS = ['card', 'label', 'link', 'spot'] as const
export type ThreadTarget = (typeof THREAD_TARGETS)[number]
export const MESSAGE_MAX = 2000

export type Thread = {
  on: ThreadTarget
  // What it's on: the card's, label's or link's id (none for a spot).
  targetId?: string
  // The plane a spot thread was started on (D-139); missing = All.
  planeId?: string
  x: number
  y: number
  uid: string
  name: string
  count: number
  lastAt: number
  // Who wrote the last message and how it began (D-166), so a thread is only new to the others and the threads panel
  // can show it without loading every thread's messages.
  lastUid?: string
  lastName?: string
  lastText?: string
  // Everyone mentioned in it (D-166), so it shows under their mentions.
  mentions?: string[]
  resolved?: boolean
  resolvedBy?: string
  createdAt: number
  updatedAt: number
}

export type ThreadMessage = {
  uid: string
  name: string
  text: string
  // Who it mentions (D-166), as `@Full Name` in the text.
  mentions?: string[]
  createdAt: number
  editedAt?: number
}
export const MENTIONS_MAX = 20

// What you've read of the workspace's threads (D-166), yours only: each thread's `lastAt` when you last saw it.
export type ThreadReads = { seen: Record<string, number>; updatedAt: number }
