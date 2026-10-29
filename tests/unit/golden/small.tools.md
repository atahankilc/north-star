=== view(p1) · kanban
# p1 deck "Build" · 2 tasks: todo 2 · doing 0 · done ✓ 0
Stuck to p5 "Customers": shows only that plane's tasks (and those for no card).
<workspace_content author="workspace">
## 01 TODO (2)
- t1 · "Interview three more owners" · due 2026-11-05 · for c1 "Anna, café owner"
- t2 · "Write the pitch" · from 2026-11-01 due 2026-11-10 · P2 · ☐ 1/2 · #pitch
## 02 DOING (0)
## 03 DONE (0) · finished
</workspace_content>

=== view(p3) · kanban (cards)
# p3 deck "Build" · holds cards: 2 cards by status (type is feature)
<workspace_content author="workspace">
## status no value (1)
- c9 · feature · "Loyalty stamps" · impact medium · effort S
## status idea (0)
## status planned (1)
- c8 · feature · "QR table ordering" · P1 · planned · impact high · effort M · ☐ 0/1
## status building (0)
## status shipped (0)
</workspace_content>

=== view(p4) · matrix
# p4 matrix "Rivals"
3 rows (competitors: every competitor + 1 typed name) × 2 columns (features: every feature on p6, criteria unfolded) · cells: scale none/partial/full · 4 filled
Cells: scale ○ none < ◐ partial < ● full · — not relevant · empty = not filled
<workspace_content author="workspace">
| competitors \ features | c9 Loyalty stamps | c8 QR table ordering · ◇ 1 open |
|---|---|---|
| c6 Orderly | ◐ partial | ◐ partial (from criteria) |
| c7 Orderly |  |  |
| Square |  | ○ none *1 |

Notes:
*1 Square × c8 QR table ordering: no QR
</workspace_content>

=== view(p5) · plane
# p5 plane "Customers" · 5 cards (2 customer, 2 problem, 1 idea) · 2 texts
Stuck to it: p1 deck "Build"
<workspace_content author="workspace">
x3 section "Ideas"
  x2 sticky "Ask Anna about Sundays" by Alice
  c5 · idea · "Pre-order from the street" · hypothesis · solves c3 · ←competes-with c6 · ←inspired-by c8
c1 · customer · "Anna, café owner" · testing +1 −0 · #smb · ←for c3 · ☐ 0/1 · ⧉ also on p6 "Market"
c2 · customer · "Baristas at rush hour"
c3 · problem · "Morning queues lose sales" · validated ! · for c1 · ←solves c5
c4 · problem · "Menus change daily"

## Links (2)
c3 —for→ c1
c5 —solves→ c3
</workspace_content>

=== view(p7) · table
# p7 table "Backlog"
3 rows (rows where type is feature + 1 added) · columns: name, status, cost (€), done, risk · sorted by cost
<workspace_content author="workspace">
| name | status | cost (€) | done | risk |
|---|---|---|---|---|
| Ops work |  | 300 € | ✓ |  |
| c8 QR table ordering | planned | 1200 € |  |  |
| c9 Loyalty stamps |  |  |  |  |
</workspace_content>

=== view(p8) · timeline
# p8 timeline (unnamed) · days of p1 · 2 tasks with days · rows by kanban · today 2026-11-03
<workspace_content author="workspace">
## p1 "Build" (2)
- 2026-11-01 → 2026-11-10 · t2 · "Write the pitch" · P2 · ☐ 1/2 · #pitch
- ◆ 2026-11-05 · t1 · "Interview three more owners" · for c1 "Anna, café owner"
</workspace_content>

=== view(p9) · documents
# p9 documents "Research" · 1 document
<workspace_content author="workspace">
- d1 · markdown · "Interview notes — Anna" · by Alice · 2026-09-21 — Anna runs two cafés and loses orders every morning.
</workspace_content>

=== view(p10) · document
# d1 markdown "Interview notes — Anna" · by Alice · 50 words
<workspace_content author="Alice">
1│ # Interview notes — Anna
2│ 
3│ ## Summary
4│ 
5│ Anna runs two cafés and loses orders every morning.
6│ 
7│ ## Quotes
8│ 
9│ - "People leave when the queue reaches the door."
10│ - "I would pay for pre-orders if it is not another tablet."
11│ 
12│ ## Next steps
13│ 
14│ Visit on a Sunday.
</workspace_content>

=== query({kind:"comment"})
query comment threads: 1 (today 2026-11-03)
<workspace_content author="workspace">
m1 on c3 "Morning queues lose sales" · open · 2 messages · last Alice 2026-09-21: "Yes, three cafés said so."
</workspace_content>

=== get([c1], full)
<workspace_content author="workspace">
## c1 · customer · "Anna, café owner" · testing +1 −0 · ☐ 0/1
on p5 "Customers" (home), p6 "Market"
tags #smb
notes:
Runs two cafés in Berlin.
evidence (1):
- v1 + supports · interview · "Loses ~20 orders every morning" · 2026-10-01
links (1):
- ← for from c3 problem "Morning queues lose sales" [e1]
tasks (1):
- t1 · "Interview three more owners" · in p1 "Build" · todo · due 2026-11-05
</workspace_content>

=== search("queue")
search "queue": 2 matches
<workspace_content author="workspace">
## in p5 plane "Customers"
- c3 · problem · "Morning queues lose sales" · validated !
## documents
- d1 markdown "Interview notes — Anna" · by Alice — …. Quotes "People leave when the queue reaches the door." "I would pay for pre-orders if it is no…
</workspace_content>

=== query({"type":"feature"})
query cards where type feature: 2 (today 2026-11-03)
<workspace_content author="workspace">
c8 · feature · "QR table ordering" · P1 · planned · impact high · effort M · inspired-by c5 · ☐ 0/1
c9 · feature · "Loyalty stamps" · impact medium · effort S
</workspace_content>

=== neighbours(c1, depth 2)
neighbours of c1 (depth 2): 6
<workspace_content author="workspace">
c1 · customer · "Anna, café owner" · testing +1 −0 · #smb · ☐ 0/1 · ⧉ on p5 "Customers", p6 "Market"
## depth 1 (4)
- ← for: c3 · problem · "Morning queues lose sales" · validated !
- task for it: t1 · "Interview three more owners" · due 2026-11-05 · for c1 "Anna, café owner"
- on plane: p5 plane "Customers" · 5 cards (2 customer, 2 problem, 1 idea) · 2 texts
- on plane: p6 plane "Market" · 6 cards (2 competitor, 2 feature, 1 package, 1 customer)
## depth 2 (2)
- c3 ← solves: c5 · idea · "Pre-order from the street" · hypothesis
- t1 its deck: p1 deck "Build" · stuck to p5 · 2 tasks: todo 2 · doing 0 · done ✓ 0
</workspace_content>

=== read_document(d1, section "Summary")
# d1 markdown "Interview notes — Anna" · by Alice · 50 words
<workspace_content author="Alice">
3│ ## Summary
4│ 
5│ Anna runs two cafés and loses orders every morning.
6│ 
</workspace_content>
Lines 3–6 of 14. Next: range "7-14", or a section by its heading.
[more: Lines 3–6 of 14. Next: range "7-14", or a section by its heading.]

=== whats_new(NOW − 2 days)
Nothing new since 2026-11-01 12:00 in what the snapshot carries.

=== where_am_i(focus on the first plane, a card picked, its panel open)
## Where the person is now
canvas: k1 "Main"
in focus: p5 plane "Customers" · 5 cards (2 customer, 2 problem, 1 idea) · 2 texts
selected (1): c1 (in full below)
panel open: c1 (selected, below)
<workspace_content author="workspace">
## c1 · customer · "Anna, café owner" · testing +1 −0 · ☐ 0/1
on p5 "Customers" (home), p6 "Market"
tags #smb
notes:
Runs two cafés in Berlin.
evidence (1):
- v1 + supports · interview · "Loses ~20 orders every morning" · 2026-10-01
links (1):
- ← for from c3 problem "Morning queues lose sales" [e1]
tasks (1):
- t1 · "Interview three more owners" · in p1 "Build" · todo · due 2026-11-05
</workspace_content>
