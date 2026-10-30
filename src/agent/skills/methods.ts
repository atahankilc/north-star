// Method knowledge (S17, D-312; docs/specs/agent.md §4.9 layer 7): short guides to well-known ways of doing startup work,
// written by us in plain words from the public methods (no copied text). Loaded only with a skill that needs one
// (skills/index.ts), never in the system prompt. Each stays short: the skill's own steps and the method together are
// held to ~600 estimated tokens (tests/unit/agentSkills.test.ts).

export const METHODS = {
  momTest: [
    'Customer interviews that tell the truth (the "Mom Test" idea): ask about their life, not your idea.',
    '- Ask about the past and the specific: "When did this last happen? What did you do? What did it cost you?"',
    '- Never ask "would you use / pay for…": people are kind about the future. Ask what they already do and pay for today.',
    '- Listen for pain they act on (money, time, workarounds); a shrug is a signal too.',
    '- Ask for a next step (an intro, a pilot, a pre-order): a yes that costs them something is the strongest evidence.',
    '- Write down facts and quotes, not opinions about your idea.',
  ].join('\n'),
  jtbd: [
    'Jobs to be done: people "hire" a product to make progress in a situation.',
    '- Say a job as: when <situation>, I want to <motivation>, so I can <outcome>.',
    '- Group customers by the job and the situation, not by age or title.',
    '- What they use today (even a notebook, a WhatsApp group, doing nothing) is the real competitor.',
  ].join('\n'),
  experiment: [
    'Experiment design: test the riskiest belief first, as cheaply as possible.',
    '- Hypothesis: "We believe <customer> will <do something measurable> because <reason>."',
    '- Signal: one number and a bar decided before you start ("8 of 20 stalls take a pre-order in a week"); say what result would make you stop.',
    '- Smallest test that could fail: talk to people, a fake door, a concierge run by hand, a pre-order, then a pilot.',
    '- Time-box it (one or two weeks), name who does each step, write down what was learned, whatever the result.',
  ].join('\n'),
  rice: [
    'Prioritising (RICE and impact × effort): reach × impact × confidence ÷ effort.',
    '- Reach: how many people it touches in a period; impact: how much it moves them (low, medium, high); confidence: how much evidence backs it; effort: S, M, L.',
    '- Low confidence lowers a score: an exciting idea with no evidence comes after a modest one that is validated.',
    '- Quick wins (high impact, small effort) first; big bets only with evidence; drop low-impact, high-effort work.',
  ].join('\n'),
  swot: [
    'SWOT: strengths and weaknesses are inside the startup (what we have or lack); opportunities and threats are outside (market, competitors, timing).',
    '- Each point is one specific line backed by a card or evidence, never a general truth ("fast-growing market").',
    '- Strengths: validated ideas and features with evidence. Weaknesses: invalidated or untested bets, gaps. Opportunities: validated problems no competitor covers well. Threats: strong competitors, contradicting evidence.',
    '- End with two or three "so what" lines: what to do because of it.',
  ].join('\n'),
  leanCanvas: [
    'Lean canvas, nine boxes in this order: 1 problem (top three), 2 customer segments (and early adopters), 3 unique value proposition (one sentence), 4 solution, 5 channels, 6 revenue streams, 7 cost structure, 8 key metrics, 9 unfair advantage.',
    '- Fill each box from the cards; a box the workspace says nothing about says "unknown: <what to find out>", never a guess.',
    '- Mark each line with how sure it is: validated, testing or a hypothesis.',
  ].join('\n'),
  positioning: [
    'Positioning: for <target customer> who <has this problem>, <product> is a <category> that <key benefit>; unlike <the main alternative>, we <the real difference>.',
    '- The alternative is what customers use today (a competitor or a workaround).',
    '- The difference must be backed by evidence or a feature, not an adjective.',
    '- A pitch: problem (with a number), who has it, the solution, why now, how we are different, traction (validated cards, evidence), the ask.',
  ].join('\n'),
} as const

export type Method = keyof typeof METHODS
