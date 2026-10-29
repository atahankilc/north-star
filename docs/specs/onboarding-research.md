# Onboarding: what the research says (2025–2026)

_Collected 2026-10-29 for [onboarding.md](onboarding.md). A reference, not rules: the rules are in onboarding.md §3._

**How solid the sources are.** The numbers come from vendor benchmarks (Chameleon, Produktly, Userpilot, Pendo) and one
NN/g study. Vendors sell tour tools, so read their numbers as signals, not proof. Public write-ups of Figma, Linear,
Notion, Miro and Excalidraw were easy to find; for tldraw, Arc, Raycast, Pitch and Framer there was little.

## 1. How leading apps onboard

- **Linear.** About seven very short screens, ~1 minute: welcome, theme, team name, import (can wait), invite
  (skippable), notifications (skippable), then a first issue with a blinking cursor. New workspaces come with **sample
  data**, so the app shows what a good workspace looks like instead of explaining it. Each **empty state** has one line
  of text, a small animation and one button. `?` opens a searchable shortcuts screen.
- **Figma / FigJam.** A welcome modal asks you to **opt in** to a tour. Each tooltip pairs **very short text with a small
  animation** of the feature. "Figma Basics" files are pre-loaded so people learn in a real file.
- **Notion.** One question first (work / personal / school), then a tailored workspace with a getting-started checklist.
- **Miro.** Leans on template boards ("Welcome to Miro", "Onboarding Playground"); teaching happens inside a board.
- **Excalidraw.** A `WelcomeScreen` only while the canvas is empty: a few quick actions and hint arrows pointing at the
  menu, toolbar and help. **It disappears once you pick a tool or draw something.** The clearest "empty state as
  onboarding" for a canvas app.
- **tldraw.** Blank canvas; help is pulled, not pushed (a shortcuts dialog, Help → accessibility with reduced motion).
- **Arc.** A rich, visual tutorial on first launch; its AI feature has a ~90 s guided demo you actually try. Criticised
  for a sign-in step you couldn't skip.
- **Raycast.** Sets the hotkey first, then offers a walkthrough.

**Works:** sample content you can touch; empty states that teach and then go away; very short text with an animation;
opt-in tours; a help/shortcuts screen you can always reopen. **Doesn't:** steps you can't skip, setup before value,
long carousels.

## 2. Evidence on tours

- **Length matters most.** Chameleon 2024: average completion 33.5 %; 5 steps = 21.6 %. Chameleon 2025: 3 steps 72 %,
  4 steps 74 %, 7+ steps 16 %. Produktly 2026 (464 companies): 1–2 steps 73 %, 3–5 38 %, 6–8 25 %, 9+ 8 %.
- **Started by the person beats started by itself.** Produktly: user-started 69 % vs auto 23 %. Chameleon:
  click-triggered 67 % vs delay-triggered 31 %; from a checklist or launcher 64–67 %.
- **Modals get dismissed a lot** (Chameleon: ~50 %).
- **Video hurts a little** (29 % completion with a video step). Average step: 23 words.
- **Checklists are mostly ignored** (Userpilot: mean 19.2 %, median 10.1 %). ~1 in 10 opens a launcher.
- **Passive hint dots are almost never opened** (Produktly: 0.1 % per impression).
- **Up-front tutorials can backfire.** NN/g (70 users, 4 apps): people who read a tutorial did no better (91 % vs 94 %),
  were not faster, and rated the tasks *harder*. NN/g: contextual help instead.
- **What's new.** 43 % of an announcement's views come in its first 48 h; changelog entries get 54 % of reads in 7 days.

## 3. Rules of thumb

- 1–3 steps per modal, never more than 4. ~20–25 words per step, one idea per step: a short title, one sentence, one visual.
- Show at the moment of use, never mid-drag, while typing or during a transition.
- One tip on screen at a time; a queue with a cooldown and a per-session cap (Appcues, Amplitude: the strictest limit wins).
  Don't chain coach marks: people dismiss them faster in a row.
- **Retire a tip when the person already did the thing** (Apple TipKit `invalidate(.actionPerformed)`).
- Tips look different from controls, so people don't click the annotation.
- Each tip: `×` and Esc; "turn off tips"; a `?` help list to replay everything.
- Keyboard and screen readers: a modal is a real dialog (focus trapped, returned on close, Esc closes). A tip beside a
  control is linked by `aria-describedby` or a polite live region and never steals focus from the canvas.

## 4. Tracking who has seen what

- **Per user, not per device** (people switch browsers); a local cache only to avoid a flash.
- **Versioned ids** (`plus-menu@1` → `@2` when the feature changes a lot).
- **What's new by last-seen version**: show entries newer than `lastSeenVersion`; new users get the welcome instead and
  their `lastSeenVersion` is set to the current one. Many entries: the biggest 2–3 and a link to the rest.
- **Invited people** skip "create a workspace": tips start from what the person meets (first `+`, first piece…), never
  from "you created a workspace"; the welcome checks whether the workspace already has content.
- **Roles**: no editing tips for viewers.

## 5. Animated demos

- **Live components with mock data beat video**: sharp, follow the theme, nothing to download, stay true after a
  redesign. Lottie must be redrawn by hand after design changes.
- 2–6 s per loop, one action; hold the end state ~1 s before looping.
- One caption line under it; the animation is never the only place the information lives.
- **WCAG 2.2.2 (A):** anything moving by itself > 5 s beside other content needs pause/stop/hide → a pause control, or
  stop after 2–3 loops.
- Reduced motion: a still frame of the telling moment (or before → after) with the caption. Still needs the pause too.

## 6. Anti-patterns

Long up-front tours; tours on a timer; several tips at once; tips covering what they explain or coming back after a
dismiss; a "what's new" on every login or taking focus mid-work; unskippable steps; teaching viewers what they can't use;
assuming they made the workspace; hotspots expected to teach; animations without pause or still frame; video steps; no
way to see a tip again.

## Sources
- Chameleon 2024 benchmark: https://www.chameleon.io/benchmark-report-24
- Chameleon, "What 550M data points say about your product tour": https://www.chameleon.io/blog/mastering-product-tours
- Produktly SaaS onboarding benchmarks 2026: https://produktly.com/research/saas-onboarding-benchmarks-2026
- Userpilot checklist completion 2024: https://userpilot.com/blog/?p=197841
- Pendo product benchmarks: https://www.pendo.io/product-benchmarks/
- NN/g mobile tutorials: https://www.nngroup.com/articles/mobile-tutorials/ ; instructional overlays: https://www.nngroup.com/articles/mobile-instructional-overlay/
- Candu, Linear teardown: https://www.candu.ai/blog/linear-onboarding-teardown
- Appcues GoodUX, Figma: https://goodux.appcues.com/blog/figmas-animated-onboarding-flow
- Excalidraw WelcomeScreen: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/children-components/welcome-screen
- tldraw: https://tldraw.dev/blog/whats-new-2025 , https://tldraw.dev/sdk-features/accessibility
- Arc: https://onboardme.substack.com/p/how-arc-browser-introduces-ai-max-feature , https://deceptive.design/articles/arc-browsers-pushy-account-requirements
- Raycast: https://manual.raycast.com/quickstart
- Appcues frequency limits: https://docs.appcues.com/experiences-frequency-limit ; Amplitude throttling: https://amplitude.com/docs/en/guides-and-surveys/throttling
- Apple TipKit: https://developer.apple.com/documentation/tipkit/tip.md
- In-app what's new: https://www.launchnotes.com/release-notes/in-app , https://www.saasui.design/blog/saas-changelog-product-updates-ux-patterns
- WCAG 2.2.2: https://www.a11y-collective.com/blog/wcag-animation/
