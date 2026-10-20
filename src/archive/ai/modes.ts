// Analysis modes (D-085): ready-made asks for the assistant, started from the empty chat or by typing `/` in it.
// A mode is only a well-written message: the chat shows what you typed (`/validate`), the model gets the full ask.
// Modes that work on one item take the card selected on the board when it's the right type, or the text after the
// command, or else let the model pick the item that needs it most.
import type { NodeType } from '../data/model'

export type Mode = {
  id: string
  label: string
  hint: string
  // The kind of item it works on, if any.
  target?: Extract<NodeType, 'idea' | 'customer' | 'competitor' | 'feature'>
  ask: (about: string | null) => string
  // Deep research (D-088): not one message but a planned run of web researchers; `ask` is unused.
  deep?: boolean
  // Works on a report (D-099): the one open on the report screen, else the one named after the command.
  report?: boolean
}

// Mode asks are written in English; the answer should still follow the user's language.
const LANGUAGE = "Answer in the language of my other messages in this chat, or English if there aren't any."

export const MODES: Mode[] = [
  {
    id: 'validate',
    label: 'validate an idea',
    hint: 'assumptions, the riskiest one, tests to run this week',
    target: 'idea',
    ask: (about) =>
      `Validate ${about ?? 'the idea that most needs it (say which and why)'}. Read it in full first, with its problem and customers. ` +
      'List the assumptions it rests on: who the customer is, that the problem hurts enough, that our answer works for them, that ' +
      "they'd pay, that we can reach them. For each, say how far the workspace backs it. Name the riskiest one and why. For the three " +
      'riskiest, suggest a cheap test we could run this week and the result that would prove us wrong. Then propose adding them under ' +
      `"Assumptions & tests" at the end of the idea's notes, keeping what's there. If I have told you what we learned (an ` +
      'interview, a number, a quote), propose it as evidence (add_evidence) on the idea, problem or customer it is about, ' +
      `and a status that follows from the evidence. ${LANGUAGE}`,
  },
  {
    id: 'interview',
    label: 'interview questions',
    hint: 'what to ask a customer, and what to listen for',
    target: 'customer',
    ask: (about) =>
      `Write customer interview questions for ${about ?? 'the customer we know least about (say which)'}. Read the customer and the ` +
      'problems linked to them first. 8 to 10 open questions about what they have done, not opinions about our idea (never "would ' +
      'you use…"), grouped: how they work today, the problem and what it costs them, what they have tried (name competitors from ' +
      `the workspace where they fit), who decides and who pays. Under each group, say what to listen for. Don't propose changes. ${LANGUAGE}`,
  },
  {
    id: 'swot',
    label: 'competitor SWOT',
    hint: 'their strengths and weaknesses, our openings and threats',
    target: 'competitor',
    ask: (about) =>
      `Do a SWOT of ${about ?? 'our most dangerous competitor (say which and why)'} against us. Read it in full first, with its ` +
      'features and matrix cells. Strengths and weaknesses are theirs; opportunities and threats are ours. Ground each point in the ' +
      'workspace (name the features and matrix cells), and say where we would need research. End with the one move it suggests for ' +
      `us. Then propose adding a short SWOT at the end of the competitor's notes, keeping what's there. ${LANGUAGE}`,
  },
  {
    id: 'gaps',
    label: 'find gaps',
    hint: "what's missing or not linked yet",
    ask: () =>
      'Find the gaps in this workspace: problems with no idea, ideas that solve no problem, items for no customer, our features ' +
      'not compared with any competitor, competitors with no features broken down, matrix cells not assessed, customers, ' +
      'problems and ideas with no evidence (still guesses) or whose status their evidence does not back. Group them, most ' +
      `important first. Propose only the links that are clearly right, and ask about the rest. ${LANGUAGE}`,
  },
  {
    id: 'criteria',
    label: 'score the matrix',
    hint: "criteria per feature, which part each competitor covers",
    target: 'feature',
    ask: (about) =>
      `Write criteria for ${about ?? 'our features in the matrix, as many as fit in one proposal, the ones with the most partial cells first'} ` +
      'and score the competitors against them. Read each feature and its matrix cells in full first (get_items). Criteria: ' +
      "3 to 5 must-haves that define the feature, each a few words, concrete enough to check in a competitor's docs; keep the " +
      'criteria a feature already has unless they are vague. Score every competitor that has a matrix cell for the feature, from ' +
      'the cell notes, their version and their features: met only where the workspace shows they do it, part where it shows ' +
      'some of it, no where it shows they do not, "not assessed" otherwise. Never guess met. Propose one set_criteria row per ' +
      'feature. Before the proposal, say in a few lines where the white space is (criteria no competitor meets) and which ' +
      `features are left for another round. ${LANGUAGE}`,
  },
  {
    id: 'prioritize',
    label: 'prioritize features',
    hint: 'impact, confidence and effort; what to build first',
    ask: () =>
      'Help me decide what to build first. Each feature has an effort, an impact and a confidence that comes from the status ' +
      'of the ideas, problems and customers it rests on (FEATURES). For features with no impact, read what they solve and ' +
      'for whom, and propose an impact (update_card), saying why in a line each. Then rank the features by impact × ' +
      'confidence ÷ effort and point out where the priority we set disagrees with that order. For the top three, say what ' +
      'we would need to learn (and from whom) to raise their confidence. Propose only impacts, never priorities: those are ' +
      `ours to set. ${LANGUAGE}`,
  },
  {
    id: 'research',
    label: 'deep research',
    hint: 'plan questions, researchers search the web, one report',
    deep: true,
    ask: () => '',
  },
  {
    id: 'analyze',
    label: 'build from a report',
    hint: 'turn the open report into cards, links and edits',
    report: true,
    ask: (about) =>
      `Analyze ${about ?? 'the report I have open (OPEN REPORT; if none is open, the newest report that fits, say which)'} and ` +
      'bring what it found onto the board. Read it in full first (get_report if it is not under OPEN REPORT), then read the ' +
      'items it touches. Compare the two: what the report adds that the board lacks, what it confirms, and what it ' +
      "contradicts. Then propose, in one set: new customers, problems, competitors (with their main features and matrix " +
      "cells) and ideas or features it clearly supports, each wired into the chain; edits to existing items where the report " +
      'adds facts or contradicts them (keep what is there, add the finding with its source URLs as "Sources: …" at the end ' +
      'of notes or description); links it implies; and one arrange_area for the new cards named after the report, unless ' +
      "they clearly belong in existing areas. Don't add what already exists: update or link to it. Only what the report " +
      "backs: no guesses dressed as findings. Propose deletes only if I asked for them. Before the proposal, say in a few " +
      `lines what the report changes for us. ${LANGUAGE}`,
  },
  {
    id: 'organize',
    label: 'organize the board',
    hint: 'group cards into named areas',
    ask: (about) =>
      `Organize the board into areas${about ? ` by ${about}` : ''}. Group every card the way that makes this startup easiest to ` +
      'read (a customer segment, a theme or a journey step per area; say which you chose and why in a sentence), give each ' +
      'area a short name, reuse existing labels that still fit and remove the ones that no longer name anything. Give each ' +
      'area the shape that shows how its cards connect (rows, columns, grid, line, hub, cycle for a loop, orbit around one ' +
      'card, tree for a breakdown, quadrant for a 2 × 2 of sections), split big areas into sections, and place related areas beside ' +
      'each other so the board reads as one picture, not a row of piles. Each area becomes a section frame (its sections ' +
      'frames inside it): reuse the names of sections already on the board that still fit, delete the frames that would ' +
      'end up empty, and colour areas only where the colour means something (a segment, the core loop). Propose it with ' +
      'arrange_area rows. If one board is too much to read (dozens of cards, several separate stories), also propose planes ' +
      '(add_plane): e.g. one holding the competitors, one per segment or MVP slice; All keeps every card. ' +
      LANGUAGE,
  },
  {
    id: 'next',
    label: 'what next',
    hint: 'the three most valuable next steps',
    ask: () =>
      'What are the three most valuable things for us to do next, given this workspace? For each: what exactly, why now, and how ' +
      `we would know it worked. Be specific to our items. Don't propose changes. ${LANGUAGE}`,
  },
  {
    id: 'pitch',
    label: 'one-page pitch',
    hint: 'the startup on one page, from the board',
    ask: () =>
      "Write a one-page pitch for what we're building, from the workspace: the customer, the problem and what it costs them, our " +
      'answer, why the options they have today fall short (name competitors), our edge, the first features, and the riskiest open ' +
      `question. Short paragraphs, no headings. Don't propose changes. ${LANGUAGE}`,
  },
]

// `/validate Rota photo import` → the mode and the text after it; null when the text isn't a mode.
export function parseMode(text: string): { mode: Mode; rest: string } | null {
  const m = /^\/([a-z]+)(?:\s+([\s\S]*))?$/i.exec(text.trim())
  const mode = m && MODES.find((x) => x.id === m[1].toLowerCase())
  return mode ? { mode, rest: (m[2] ?? '').trim() } : null
}

// What the mode works on: the text after the command, else the selected item if it's the right type.
// A report mode (D-099) names the report from the rest, or works on the open one; `openReport` is its title.
export function modeAbout(
  mode: Mode,
  rest: string,
  selected: { type: NodeType; name: string } | null,
  openReport: string | null = null,
): string | null {
  if (mode.report) {
    if (rest && openReport) return `the report I have open, "${openReport}", with this in mind: ${rest}`
    if (rest) return `the report "${rest}" (or, if no report has that title, the open one with this in mind: ${rest})`
    return openReport ? `the report I have open, "${openReport}"` : null
  }
  // A mode without an item takes the rest as is (`/organize customer segment`).
  if (!mode.target) return rest || null
  if (rest) return `the ${mode.target} "${rest}"`
  if (selected?.type === mode.target) return `the ${mode.target} "${selected.name}" (selected on the board)`
  return null
}
