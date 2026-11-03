// The web (D-360, docs/specs/agent-web.md): the agent searches the web through its provider's own tool (OpenAI's
// hosted `web_search`, Claude's `web_search` server tool), on the person's key; nothing in the app fetches a page. On
// every turn, the model deciding when (the user, 2026-11-02: always on); capped per response so one turn can't run up a
// bill. The pages come back as sources, shown under the answer as links, cited ones first.

// The most searches one response may run (each about $0.01 on the person's account, both providers).
export const WEB_SEARCHES = 5

// What one search costs, in dollars ($10 per 1000 on OpenAI and Anthropic, 2026-11).
export const SEARCH_PRICE = 0.01

// A source's site, for the list under an answer: `example.com` from `https://www.example.com/a/b`.
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// `/research` (D-360 step 2, loosened by D-362): at most this many questions one research call takes, how many
// researchers run at once (one call or several), and how many searches one researcher may run (more than a chat
// response's WEB_SEARCHES: it answers one question in depth). Calls aren't counted: the agent researches again where the
// findings leave a gap. A call costs at most RESEARCH_QUESTIONS × RESEARCH_SEARCHES searches.
export const RESEARCH_QUESTIONS = 20
export const RESEARCHERS = 3
export const RESEARCH_SEARCHES = 15
