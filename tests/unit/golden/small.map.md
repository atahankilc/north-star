# Workspace map
Ids (stable in this chat; a title works too): c card · p piece · x text · t task · d document · k canvas · u person · e link · v evidence · f competitor feature · m comment thread
Reading a line: +a −b evidence for/against · ! status and evidence disagree · ☐ d/a tasks done/all · ⧉ on more than one plane (or canvas) · 7/5 count/limit · ✓ finished column · for cN tagged for that customer · part of cN its parent · solves cN, ←solves cN links from it / to it · #tag
<workspace_content author="workspace">
Today: 2026-11-03
Project: "Tablebook" — building "Ordering ahead for small cafés"
People: u1 Alice (owner) · u2 Bob (editor) · u3 Carol (viewer)
Holds: 2 canvases · 10 pieces · 10 cards · 4 links · 4 tasks · 4 texts · 1 document · 1 comment thread
Comments: 1 thread (0 resolved) on c3 · query({kind: "comment"}) lists them

## k1 canvas "Main"
x4 project title "Tablebook — Ordering ahead for small cafés"
x1 heading H1 "Who we beat" (02)
- p5 plane "Customers" · 5 cards (2 customer, 2 problem, 1 idea) · 2 texts
  x3 section "Ideas"
    x2 sticky "Ask Anna about Sundays" by Alice
    c5 · idea · "Pre-order from the street" · hypothesis · solves c3 · ←competes-with c6 · ←inspired-by c8
  c1 · customer · "Anna, café owner" · testing +1 −0 · #smb · ←for c3 · ☐ 0/1 · ⧉ also on p6 "Market"
  c2 · customer · "Baristas at rush hour"
  c3 · problem · "Morning queues lose sales" · validated ! · for c1 · ←solves c5
  c4 · problem · "Menus change daily"
- p6 plane "Market" · 6 cards (2 competitor, 2 feature, 1 package, 1 customer) · ⧉ also on k2
  c6 · competitor · "Orderly" · Germany · 1 feature · competes-with c5
  c8 · feature · "QR table ordering" · P1 · planned · impact high · effort M · inspired-by c5 · ☐ 0/1
  c9 · feature · "Loyalty stamps" · impact medium · effort S
  c7 · competitor · "Orderly"
  c1 · customer · "Anna, café owner" · ⧉ its home is p5
  c10 · package · "Package 1" · holds 2 features
- p7 table "Backlog" · 3 rows (rows where type is feature + 1 added) · columns: name, status, cost (€), done, risk
- p9 documents "Research" · 1 document
- p10 document "Interview notes — Anna" · shows d1 (markdown, 50 words)
- p1 deck "Build" · stuck to p5 · 2 tasks: todo 2 · doing 0 · done ✓ 0
  t1 · "Interview three more owners" · due 2026-11-05 · for c1 · todo
  t2 · "Write the pitch" · from 2026-11-01 due 2026-11-10 · P2 · ☐ 1/2 · #pitch · todo
- p8 timeline (unnamed) · stuck to p1 · days of p1 · 2 tasks with days · rows by kanban
- p4 matrix "Rivals" · 3 rows (competitors: every competitor + 1 typed name) × 2 columns (features: every feature on p6, criteria unfolded) · cells: scale none/partial/full · 4 filled
- p2 deck "Ops" · 1 task: Todo 0 · review 1/3 · shipped ✓ 0
  t4 · "Check the invoices" · review
- p3 deck "Build" · holds cards: 2 cards by status (type is feature)

## k2 canvas "Engineering"
- p6 "Market" (also shown here; its own canvas is k1)

## Documents (1)
d1 · markdown · "Interview notes — Anna" · by Alice · 50 words
</workspace_content>