// Skills: the `/` commands (S17, D-312; docs/specs/agent.md §4.10's table, §4.9 layer 7, §6 Phase 9). A skill is a short
// guide for one kind of job: what it is for, the steps, the method knowledge it needs (methods.ts) and the tools to lean
// on. The system prompt lists only the names and one-liners (prompt.ts' "Skills"); when the person's message starts with
// `/name`, the loop adds that skill's guide as a developer message for that turn only (loop.ts), so the prompt stays
// ≤ 4k tokens and a guide costs only when it's used. An unknown `/x` goes to the model as an ordinary message, with a
// one-line note listing the skills.
// Pure: no React, no Firebase. `/research` needs the web (Phase 9's other half): not here yet.
import { METHODS, type Method } from './methods'

export type SkillGroup = 'analysis' | 'building' | 'documents'

export type Skill = {
  name: string
  // One line for the `/` menu and the system prompt.
  summary: string
  // What goes after the name, for the menu (`<idea>`); left out: nothing needed.
  usage?: string
  group: SkillGroup
  // How the model should use it, one or two sentences.
  when: string
  // The steps, plain words.
  steps: string[]
  // Method knowledge loaded with it.
  methods?: Method[]
  // Tools (and ops) to lean on.
  tools?: string[]
  // A big job: plan first, change nothing until the person says go.
  plan?: boolean
}

const CITE = 'Every claim about the workspace names its card: short id and title, as c12 "Title". A claim the workspace doesn\'t back says "unknown" instead.'
const DOC = 'Write it with create_document (one call, Markdown, private unless the person asks to share it): a title, short sections with headings, bullet lines. ' + CITE + ' Then answer in two or three lines: what the document holds and that it waits in the preview.'

export const SKILLS: Skill[] = [
  // ---- Analysis
  {
    name: 'ask',
    summary: 'any question about the workspace, answered with links to the items',
    usage: '<question>',
    group: 'analysis',
    when: 'The default: the person wants an answer, not a change.',
    steps: ['Find it (the map, search, query, get, view), then answer first, with each item that backs it by short id.', 'Change nothing; offer one next step at most.'],
    tools: ['search', 'query', 'get', 'view'],
  },
  {
    name: 'gaps',
    summary: "what's untested, unbacked, unlinked, contradicting or stale, each with a fix",
    group: 'analysis',
    when: 'An audit of how well the workspace backs its claims. Answer only; change nothing until the person picks fixes.',
    steps: [
      'Look for, with query (kind card) and get:',
      '- untested: customers, problems and ideas still a hypothesis with no evidence (no_evidence);',
      '- unbacked: validated with no evidence, or `!` where status and evidence disagree (contradicting);',
      '- unlinked: a problem with no customer (no for link), an idea that solves nothing, a feature no idea inspired;',
      '- stale: testing with no task, or tasks overdue on its cards.',
      'Answer by group, worst first, at most five items each, each cited, each with the fix you can propose (a test task, a link, a status, evidence to find).',
      'End: "Say which to fix and I\'ll propose the changes."',
    ],
    tools: ['query', 'get', 'neighbours'],
  },
  {
    name: 'next',
    summary: 'the next three things worth doing; as tasks on a deck if you want',
    group: 'analysis',
    when: 'The person wants focus. Three things, not ten.',
    steps: [
      'Read the riskiest beliefs (hypotheses and testing cards with little evidence, `!` cards), late or stuck tasks, and what the agent notes say matters.',
      'Pick three: each a concrete action (who, what, by when), why it matters now, and the card it moves (cited).',
      'If the person asked for tasks (or says yes later): create_task on a deck they name or the first deck of tasks, each linked to its card (card), with a due day; else offer it.',
    ],
    methods: ['rice', 'experiment'],
    tools: ['query', 'get', 'view', 'change'],
  },
  {
    name: 'digest',
    summary: 'what changed since you last looked, by person and plane',
    usage: '<since, e.g. yesterday>',
    group: 'analysis',
    when: 'Catching up after time away.',
    steps: [
      'Call whats_new with since (the person\'s words, else 24 hours before Today in the map).',
      'Group by person, then by plane or piece; say what was made, changed or moved, each item cited. Say "the agent" for the agent\'s changes.',
      'End with what needs the person: comments to answer, tasks newly given to them, contradicting evidence.',
      'If nothing changed, say so in one line.',
    ],
    tools: ['whats_new', 'get', 'query'],
  },
  {
    name: 'review-deck',
    summary: 'late, stuck and unassigned tasks on a deck, with suggestions',
    usage: '<deck>',
    group: 'analysis',
    when: 'A health check of a deck. Answer first; move or split tasks only when the person agrees.',
    steps: [
      'view the deck (the one named, else the deck in view, else the first deck of tasks).',
      'List: late (due before Today, not finished), stuck (a column over its limit, or many tasks in doing), given to no one, with no card.',
      'For each, one suggestion: move it, give it to someone, split it (two smaller tasks), set a due day, or drop it.',
      'Offer to make those changes (move_task, update_task, create_task) as one preview.',
    ],
    tools: ['view', 'query', 'get', 'change'],
  },
  // ---- Building
  {
    name: 'test',
    summary: 'an experiment plan for an idea: hypothesis, signal, a deck of dated tasks',
    usage: '<idea>',
    group: 'building',
    plan: true,
    when: 'Turning a belief into an experiment.',
    steps: [
      'get the idea (and the problem and customer it is for).',
      'Plan, then wait for go: the hypothesis, the signal with its bar, the smallest test, and 3–5 tasks with days over one or two weeks.',
      'On go, in one change: create_piece a deck named "Test: <idea>" on the idea\'s canvas, create_task each task with card: the idea, start and due days; update_card the idea\'s validation to testing if it was a hypothesis.',
    ],
    methods: ['experiment'],
    tools: ['get', 'neighbours', 'change'],
  },
  {
    name: 'compare',
    summary: 'our features against competitors as a matrix, filled from what we know',
    group: 'building',
    plan: true,
    when: 'A features × competitors matrix.',
    steps: [
      'Read our features (a plane the person names, else every feature), the competitors and their features (get).',
      'Plan, then wait for go.',
      'On go, in one change: create_piece a matrix (template compare, rows: type feature on that plane, cols: type competitor), then update_cell only where a competitor feature matches ours (none, partial, full, better), with confidence documented for a match and guess otherwise; leave a cell empty when the workspace says nothing (that is the gap: say it as ?).',
      'Answer: how many cells filled, where the gaps are (cited).',
    ],
    tools: ['query', 'get', 'view', 'change'],
  },
  {
    name: 'prioritize',
    summary: 'the priorities deck filled and explained (impact × effort, confidence)',
    group: 'building',
    plan: true,
    when: 'Ordering features and packages.',
    steps: [
      'Find the priorities deck (a deck holding cards by effort × impact); if there is none, plan to make one (create_piece deck, template priorities).',
      'Find features missing impact or effort; estimate only from what their cards, links and evidence say, and say why per card.',
      'Plan, then wait for go. On go: update_card impact/effort on those features (one change).',
      'Explain the order: impact × confidence ÷ effort, the top three and the bottom three, each cited; P2 → P1 moves you suggest, never written as priority unless asked.',
    ],
    methods: ['rice'],
    tools: ['query', 'get', 'view', 'change'],
  },
  {
    name: 'organize',
    summary: 'a plane tidied: grouped by meaning, with headings, the app placing',
    usage: '<plane>',
    group: 'building',
    plan: true,
    when: 'A messy plane made readable. Nothing is deleted.',
    steps: [
      'view the plane (the one named or in focus).',
      'Plan the groups by meaning (by type, then by customer or theme), each with a heading; wait for go.',
      'On go: one arrange with layout cluster (by type, tag or status, or your own groups) and headings: true; never coordinates.',
      'Answer with the groups and what is in each (cited).',
    ],
    methods: ['jtbd'],
    tools: ['view', 'change'],
  },
  {
    name: 'sort-stickies',
    summary: 'sticky notes turned into cards, grouped in sections',
    usage: '<plane>',
    group: 'building',
    plan: true,
    when: 'Turning loose notes into cards.',
    steps: [
      'query kind text type sticky (on the plane named, else in focus, else everywhere) and read each.',
      'Decide each note\'s card type by meaning (a who → customer, a pain → problem, a rival → competitor, a what-if → idea, a thing to build → feature); a note that repeats a card already there links to it instead.',
      'Plan, then wait for go. On go, one change: create_card each (title in the note\'s words) on the same plane, then create_text a section around the new cards of each type.',
      'Leave the stickies; offer to remove them (only after a yes).',
    ],
    tools: ['query', 'search', 'change'],
  },
  {
    name: 'learn',
    summary: 'pasted interview notes turned into evidence on the right cards',
    usage: '<notes>',
    group: 'building',
    when: 'The person pastes notes (or names a document): each fact becomes evidence on the card it is about.',
    steps: [
      'Read the notes (the message, or read_document). Pull out facts and quotes, not opinions.',
      'Match each to a customer, problem or idea (search); create_evidence on it: kind interview or quote, the fact in their words, stance supports or contradicts, source (who and when).',
      'A fact with no card: propose one new card (create_card) only if it is clearly a new problem or customer.',
      'Suggest status changes (testing → validated, or invalidated) as words, citing the evidence; change status only if the person says so.',
    ],
    methods: ['momTest'],
    tools: ['search', 'get', 'read_document', 'change'],
  },
  {
    name: 'dedupe',
    summary: 'near-duplicate cards found and merged, keeping links, evidence and places',
    group: 'building',
    when: 'Finding cards that say the same thing twice.',
    steps: [
      'query by type and compare titles: same words, a word or two apart, "(early)" or "(core)" variants, the same thing on two planes.',
      'List the pairs, each with which one to keep (more links and evidence, the older one) and why; ask "merge them?". Change nothing in that turn.',
      'After a yes: one change with merge_cards per pair (keep, merge, why), which moves links, evidence, tasks, planes and entries to the kept card.',
    ],
    tools: ['query', 'search', 'get', 'change'],
  },
  {
    name: 'import',
    summary: 'a pasted list or table turned into cards, tasks or rows',
    usage: '<pasted list>',
    group: 'building',
    when: 'Bringing outside lists in.',
    steps: [
      'Read what was pasted: a list (one thing per line) or a table (the first row names the columns).',
      'Decide what each line becomes: cards (a type per line, by meaning or a column), tasks (on a deck the person names), or rows (axis_add on a table).',
      'Skip lines that repeat a card already there (search), and say which.',
      'Up to ten things: one change at once. More: plan first, then wait for go. Fields from columns (status, tags, due) go into the op\'s fields.',
    ],
    tools: ['search', 'query', 'change'],
  },
  // ---- Documents
  {
    name: 'interview',
    summary: 'a Mom Test interview script for a customer or problem, as a document',
    usage: '<customer or problem>',
    group: 'documents',
    when: 'Getting ready to talk to customers.',
    steps: [
      'get the customer or problem and what links to it (its problems, ideas, evidence).',
      'Script: who to talk to and why (cited), 3 warm-up questions about their week, 6–8 questions about the past and the specific (one per belief to test, each naming the card it tests), what to listen for, the next step to ask for.',
      DOC,
    ],
    methods: ['momTest'],
    tools: ['get', 'neighbours', 'change'],
  },
  {
    name: 'swot',
    summary: 'a SWOT of the startup from its cards, as a document',
    group: 'documents',
    when: 'A one-page strategic read.',
    steps: ['Read validated and invalidated cards, competitors and their regions, contradicting evidence (query).', 'Four sections, three to five lines each, then "So what".', DOC],
    methods: ['swot'],
    tools: ['query', 'get', 'change'],
  },
  {
    name: 'one-pager',
    summary: 'a one-page summary of the startup, as a document',
    group: 'documents',
    when: 'Something to send an advisor or a new teammate.',
    steps: [
      'Read the project title, customers, top problems, ideas, features in progress, competitors, open questions.',
      'Sections: what we do (one sentence), for whom, the problem, our approach, where we are (validated vs open), competitors, next steps.',
      DOC,
    ],
    methods: ['positioning'],
    tools: ['query', 'get', 'change'],
  },
  {
    name: 'pitch',
    summary: 'a pitch outline from the workspace, as a document',
    group: 'documents',
    when: 'A talk track for investors or partners.',
    steps: ['Read as for a one-pager, plus evidence with numbers.', 'Sections in pitch order (the positioning guide below), each two to four lines, the positioning sentence at the top.', DOC],
    methods: ['positioning'],
    tools: ['query', 'get', 'change'],
  },
  {
    name: 'lean-canvas',
    summary: 'a lean canvas filled from the cards, as a document',
    group: 'documents',
    when: 'The business on one page, box by box.',
    steps: ['Read customers, problems, ideas, features, competitors, evidence.', 'The nine boxes in order, each from the cards, unknowns said as unknown.', DOC],
    methods: ['leanCanvas'],
    tools: ['query', 'get', 'change'],
  },
]

export const SKILL_NAMES = SKILLS.map((s) => s.name)
const BY = new Map(SKILLS.map((s) => [s.name, s]))
export const skillNamed = (name: string) => BY.get(name.toLowerCase())

// `/name rest…` at the very start of a message: the skill (or the unknown name) and what follows.
export function parseSkill(message: string): { skill: Skill; rest: string } | { unknown: string } | null {
  const m = /^\s*\/([a-z][a-z-]*)\b(?![/.])\s*([\s\S]*)$/i.exec(message)
  if (!m) return null
  const skill = skillNamed(m[1])
  return skill ? { skill, rest: m[2].trim() } : { unknown: m[1].toLowerCase() }
}

// The guide as the model gets it for that turn (a developer message right before the person's message).
export function skillGuide(skill: Skill, rest = ''): string {
  return [
    `## Skill: /${skill.name} (the person started their message with it; follow this guide for this turn)`,
    skill.when,
    skill.plan ? 'This is a big job: answer first with a short numbered plan and make no change; wait for the person to say go.' : '',
    'Steps:',
    ...skill.steps.map((s) => (s.startsWith('-') ? s : `- ${s}`)),
    ...(skill.methods ?? []).map((m) => `Method:\n${METHODS[m]}`),
    skill.tools?.length ? `Lean on: ${skill.tools.join(', ')}.` : '',
    rest ? 'What the person wrote after the command is their message below.' : 'They wrote nothing after the command: use what they have selected or open, else ask one short question only if you cannot pick a sensible scope.',
  ]
    .filter(Boolean)
    .join('\n')
}

// The system prompt's list: one line per skill.
export const SKILL_LINES = SKILLS.map((s) => `/${s.name}${s.usage ? ` ${s.usage}` : ''}: ${s.summary}`).join('\n')

// The note the model gets with a message starting with an unknown `/x`: treat it as an ordinary message.
export function unknownSkillNote(name: string): string {
  return `The message starts with /${name}, which is not a skill (the skills: ${SKILLS.map((s) => `/${s.name}`).join(' ')}). Treat it as an ordinary message; if it seems meant as a skill, say which one fits in one line.`
}

// A reply listing the skills (kept for a client that wants to answer without the model).
export function unknownSkillReply(name: string): string {
  const near = SKILLS.filter((s) => s.name.startsWith(name.slice(0, 2))).map((s) => `/${s.name}`)
  return [
    `There's no /${name}.${near.length ? ` Did you mean ${near.join(' or ')}?` : ''} The skills are:`,
    ...SKILLS.map((s) => `- /${s.name}${s.usage ? ` ${s.usage}` : ''}: ${s.summary}`),
    '/research (the web) comes later. Or just ask in your own words.',
  ].join('\n')
}
