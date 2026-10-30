=== view(p1) · plane
# p1 plane "Segments" · 33 cards (14 customer, 16 problem, 3 feature) · 4 texts
Stuck to it: p5 matrix "Pain map"
<workspace_content author="workspace">
x2 section "Segments"
  c1 · customer · "Retired regulars near the tram" · invalidated +0 −1 · contradicts c106 · ←for c107 · ⧉ also on p9 "Roadmap"
  c2 · customer · "Organic farmers in Beşiktaş (early)" · validated ! · relates c131 · ←for c61
  c3 · customer · "Office lunch groups in Kreuzberg" · hypothesis · #b2c · ←for c22
  c4 · customer · "Restaurant buyers new to the city (early)" · invalidated +1 −0 ! · #b2c · ←for c93 c18
  c5 · customer · "Stall owners new to the city" · validated ! · #trust · contradicts c36 · ←for c21 c90
  c6 · customer · "Young parents with big families" · testing · ←contradicts c68 · ←for c142 c23 c117
  c7 · customer · "Organic farmers in Beşiktaş" · testing · #b2b #pricing · ←for c101 c53
  c8 · customer · "Retired regulars on Saturdays (core)" · hypothesis · ←relates c148 · ←for c110 c66 c34
  c9 · customer · "Organic farmers who pay cash" · validated ! · relates c64 · ←for c34
  c10 · customer · "Young parents without a car" · invalidated +1 −0 ! · #b2c · ←relates c71 · ←for c55 c90 c106
  c11 · customer · "Bakers near the tram" · testing +3 −0 · ←contradicts c124 · ←for c70 c105 c49
  c12 · customer · "Young parents on Saturdays (core)" · hypothesis · #b2c · ←for c87 c142 c66 c109 c65
  c13 · customer · "Office lunch groups new to the city" · hypothesis · ←for c87 c58 c137
  c14 · customer · "Students who pay cash (early)" · testing · ←for c114 c96
x4 sticky "Maybe start with bread" by Mert Kaya
x5 sticky "Cash only is a big deal" by Ayşe Demir
x3 heading H2 "What hurts"
c15 · problem · "Restaurant buyers never know prices before they arrive" · hypothesis · part of c24
c16 · problem · "Bakers carry heavy bags home on foot" · hypothesis · ←solves c60 c133 · ←competes-with c35
c17 · problem · "Young parents can't take card payments" · testing · part of c29 · ←solves c135 · ←contradicts c97
c18 · problem · "Students throw away unsold greens every evening" · hypothesis · for c4 · part of c20 · ←competes-with c43 · ←part-of c19
c19 · problem · "Restaurant buyers pay too much at the supermarket instead" · hypothesis · part of c18 · relates c133 · ←solves c64 c58 · ←part-of c28
c20 · problem · "Bakers never know prices before they arrive" · hypothesis · #b2c · for c81 · ←solves c61 c71 · ←part-of c18
c98 · feature · "Pickup slots pickup slots" · P3 · planned · effort L · #b2c #istanbul · ←part-of c97 · ☐ 0/1 · ⧉ its home is p9
c21 · problem · "Retired regulars can't tell what is in season this week" · hypothesis · for c5 · ←solves c56
c22 · problem · "Organic farmers have no way to reserve the last loaves" · validated +1 −1 · for c3 · ←solves c137 c59 c67 c57 · ←competes-with c47
c23 · problem · "Office lunch groups sell out by 10am and turn people away" · validated +2 −1 · for c6
c24 · problem · "Weekend shoppers sell out by 10am and turn people away" · testing +2 −0 · links: ←solves 3, ←competes-with 1, ←part-of 2, ←relates 2
c25 · problem · "Organic farmers throw away unsold greens every evening" · hypothesis · ←solves c140 c72 · ←competes-with c47
c26 · problem · "Students carry heavy bags home on foot" · invalidated ! · part of c24 · ←solves c58 c135 c57 c64 · ←competes-with c48 · ←part-of c28
c119 · feature · "Stall reviews price list" · P3 · planned · effort L · #pricing #trust · for c131 · part of c110 · inspired-by c69 · part-of c103 · depends-on c124 c145 c102 · ⧉ its home is p9
c126 · feature · "Loyalty stamps chat" · P3 · shipped · impact medium · effort M · #supply · for c79 · inspired-by c68 · depends-on c147 · ←contradicts c121 · ☐ 0/1 · ⧉ its home is p9
c27 · problem · "Retired regulars throw away unsold greens every evening" · hypothesis · for c78 · ←solves c61 c133 · ←competes-with c46 c41
c28 · problem · "Organic farmers can't take card payments" · testing · part of c19 · part-of c26 · ←solves c138
c29 · problem · "Restaurant buyers miss the market when it rains" · hypothesis · for c79 · ←solves c140 · ←part-of c17
c30 · problem · "Students wait in long queues at the cheese stall" · hypothesis · #supply · ←solves c58 · ←competes-with c47

## Links (11)
c15 —part-of→ c24
c26 —part-of→ c24
c21 —for→ c5
c28 —part-of→ c19
c23 —for→ c6
c17 —part-of→ c29
c19 —part-of→ c18
c22 —for→ c3
c18 —part-of→ c20
c28 —part-of→ c26
c18 —for→ c4
</workspace_content>

=== view(p5) · matrix
# p5 matrix "Pain map" · stuck to p1
14 rows (problems: every problem on p1 (2 taken out)) × 8 columns (customers: every customer on p1 (6 taken out)) · cells: scale low/medium/high · 73 filled
Cells: scale ▁ low < ▄ medium < █ high · — not relevant · empty = not filled
<workspace_content author="workspace">
| problems \ customers | c3 Office lunch groups in Kreuzb… | c7 Organic farmers in Beşiktaş | c2 Organic farmers in Beşiktaş (… | c4 Restaurant buyers new to the… | c1 Retired regulars near the tram | c8 Retired regulars on Saturdays… | c5 Stall owners new to the city | c6 Young parents with big famili… | total |
|---|---|---|---|---|---|---|---|---|---|
| c16 Bakers carry heavy bags home… | █ high | █ high |  |  | █ high |  | ▁ low | ▄ medium | 1 low · 1 medium · 3 high |
| c20 Bakers never know prices befo… |  |  | █ high | ▄ medium | ▄ medium | ▁ low | █ high | ▁ low *1 | 2 low · 2 medium · 2 high |
| c23 Office lunch groups sell out… | █ high | █ high |  | █ high | ▄ medium | ▁ low |  | ▁ low | 2 low · 1 medium · 3 high |
| c28 Organic farmers can't take ca… | ▁ low |  |  | ▁ low | █ high | ▁ low | ▄ medium |  | 3 low · 1 medium · 1 high |
| c22 Organic farmers have no way t… | ▄ medium | ▄ medium |  |  |  | ▄ medium |  |  | 3 medium |
| c25 Organic farmers throw away un… |  | █ high | ▁ low | ▄ medium | ▁ low | ▁ low *2 | █ high | █ high | 3 low · 1 medium · 3 high |
| c15 Restaurant buyers never know… | ▄ medium | ▁ low | █ high *3 |  | █ high *4 | ▁ low *5 | ▄ medium | ▁ low | 3 low · 2 medium · 2 high |
| c19 Restaurant buyers pay too muc… | ▄ medium | █ high |  | █ high | ▁ low | ▄ medium |  |  | 1 low · 2 medium · 2 high |
| c21 Retired regulars can't tell w… | ▄ medium |  | ▁ low |  | ▄ medium |  | ▁ low | ▁ low | 3 low · 2 medium |
| c27 Retired regulars throw away u… | █ high | █ high |  | █ high |  | ▄ medium | ▁ low | ▁ low | 2 low · 1 medium · 3 high |
| c26 Students carry heavy bags hom… |  | █ high | ▄ medium |  |  |  |  |  | 1 medium · 1 high |
| c18 Students throw away unsold gr… | █ high |  |  | █ high | █ high | █ high |  | █ high | 5 high |
| c24 Weekend shoppers sell out by… | ▄ medium | ▁ low | █ high | ▄ medium | — |  |  |  | 1 low · 2 medium · 1 high |
| c17 Young parents can't take card… | █ high | ▄ medium | ▄ medium | █ high |  | ▁ low | █ high *6 | █ high | 1 low · 2 medium · 4 high |
| total | 1 low · 5 medium · 5 high | 2 low · 2 medium · 6 high | 2 low · 2 medium · 3 high | 1 low · 3 medium · 5 high | 2 low · 3 medium · 4 high | 6 low · 3 medium · 1 high | 3 low · 2 medium · 3 high | 5 low · 1 medium · 3 high | |

Notes:
*1 c20 Bakers never know prices befo… × c6 Young parents with big famili…: Asked twice whether we deliver
*2 c25 Organic farmers throw away un… × c8 Retired regulars on Saturdays…: Said she throws away 4 crates of greens a week
*3 c15 Restaurant buyers never know… × c2 Organic farmers in Beşiktaş (…: Asked twice whether we deliver
*4 c15 Restaurant buyers never know… × c1 Retired regulars near the tram: Only 1 in 8 stalls takes cards
*5 c15 Restaurant buyers never know… × c8 Retired regulars on Saturdays…: Would pay 2 € more to skip the queue
*6 c17 Young parents can't take card… × c5 Stall owners new to the city: Did not want to install another app
</workspace_content>

=== view(p6) · kanban
# p6 deck "Research" · 20 tasks: todo 5 · doing 3/5 · review 6 · done ✓ 6 · 5 overdue
<workspace_content author="workspace">
## 01 TODO (5)
- t1 · "Visit five stall owners" · due 2026-10-19 (overdue) · for c61 "Reserve stall opening hours with neighb…"
- t2 · "Test a pricing survey" · due 2026-11-28 · for c34 "Neighbourhood cooks can't tell what is…" · ☐ 1/3
- t3 · "Draft five stall owners" · → u3 Mert Kaya · for c88 "Restaurant buyers lose regulars when th…" · P2
- t4 · "Write the WhatsApp bot" · → u2 Jonas Weber · from 2026-10-26 due 2026-10-29 (overdue) · for c136 "Reserve market maps the night before" · P3
- t5 · "Draft the stall onboarding" · → u1 Ayşe Demir · due 2026-10-18 (overdue) · #trust
## 02 DOING (3/5 limit)
- t6 · "Ship the pickup flow" · → u2 Jonas Weber · from 2026-11-02 due 2026-11-07 · for c34 "Neighbourhood cooks can't tell what is…" · P1 · #trust
- t7 · "Price Saturday pilot" · → u1 Ayşe Demir · from 2026-10-26 due 2026-10-28 (overdue) · P2 · ☐ 3/4
- t8 · "Test Saturday pilot" · → u2 Jonas Weber · ☐ 0/2
## 03 REVIEW (6)
- t9 · "Test the landing page" · due 2026-11-14
- t10 · "Call the Kreuzberg market" · P1
- t11 · "Price Saturday pilot" · → u2 Jonas Weber · due 2026-12-06 · #mvp
- t12 · "Write Saturday pilot" · → u1 Ayşe Demir · #pricing
- t13 · "Interview the stall onboarding" · from 2026-10-22 due 2026-10-27 (overdue)
- t14 · "Call the Kreuzberg market" · → u3 Mert Kaya · due 2026-11-10 · for c124 "Stall reviews reminder" · ☐ 2/2 · #b2c
## 04 DONE (6) · finished
- t15 · "Design the order email" · → u1 Ayşe Demir · from 2026-10-18 due 2026-10-22
- t16 · "Test Saturday pilot" · from 2026-10-10 due 2026-10-15 · for c37 "Bazaarcart"
- t17 · "Map a pricing survey" · from 2026-10-21 due 2026-10-22 · for c46 "Stallbox" · P2 · #trust
- t18 · "Visit the order email" · → u1 Ayşe Demir · due 2026-11-11 · P1 · #b2c
- t19 · "Call Saturday pilot" · → u1 Ayşe Demir · due 2026-10-25
- t20 · "Ship the Kreuzberg market" · for c100 "Stall opening hours price list"
</workspace_content>

=== view(p7) · documents
# p7 documents "Research" · 4 documents
<workspace_content author="workspace">
- d4 · markdown · "Competitor teardown" · by Ayşe Demir · 2026-07-23 — The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste. Uses WhatsAp…
- d3 · markdown · "Pilot week 2 report" · by Jonas Weber · 2026-07-23 — The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste. Asked twice…
- d2 · markdown · "Pricing research" · by Jonas Weber · 2026-07-23 — The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste. Bought the s…
- d1 · markdown · "Interview notes — stall owners" · by Mert Kaya · 2026-07-23 — Restaurants buy in bulk early in the morning; they are a different product from weekend shoppers. S…
</workspace_content>

=== view(p8) · document
# d1 markdown "Interview notes — stall owners" · by Mert Kaya · 326 words
<workspace_content author="Mert Kaya">
1│ # Interview notes — stall owners
2│ 
3│ ## Open questions
4│ 
5│ Restaurants buy in bulk early in the morning; they are a different product from weekend shoppers. Said she throws away 4 crates of greens a week.
6│ 
7│ ## Quotes
8│ 
9│ The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste. Uses WhatsApp groups to tell regulars what came in.
10│ 
11│ ## What we heard
12│ 
13│ The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste. Uses WhatsApp groups to tell regulars what came in.
14│ The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste. Uses WhatsApp groups to tell regulars what came in.
15│ 
16│ ## Summary
17│ 
18│ The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste. Said she throws away 4 crates of greens a week.
19│ Restaurants buy in bulk early in the morning; they are a different product from weekend shoppers. Said she throws away 4 crates of greens a week.
20│ Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it. Would pay 2 € more to skip the queue.
21│ 
22│ ## Next steps
23│ 
24│ Restaurants buy in bulk early in the morning; they are a different product from weekend shoppers. Would pay 2 € more to skip the queue.
25│ 
26│ ## Numbers
27│ 
28│ The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste. Would pay 2 € more to skip the queue.
29│ Restaurants buy in bulk early in the morning; they are a different product from weekend shoppers. Bought the same basket four weeks running.
30│ The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste. Said she throws away 4 crates of greens a week.
31│ 
32│ - Did not want to install another app
33│ - Came back three Saturdays in a row after the reminder
34│ - Said she throws away 4 crates of greens a week
35│ 
</workspace_content>

=== view(p12) · table
# p12 table "Backlog"
39 rows (rows where type is feature + 1 added) · columns: name, status, priority, impact, cost (€), risk, owner · sorted by cost (high first)
<workspace_content author="workspace">
| name | status | priority | impact | cost (€) | risk | owner |
|---|---|---|---|---|---|---|
| c102 Seasonal boxes dashboard | shipped |  | high | 3800 € |  |  |
| c146 Seasonal boxes QR codes | idea | P2 | high | 3700 € | high |  |
| c112 Market maps chat |  | P3 | medium | 3300 € |  |  |
| c122 Leftover produce checkout |  |  | medium | 2800 € |  |  |
| c120 Stall opening hours reminder | idea | P2 |  | 2600 € |  |  |
| c106 Market maps ratings | building | P1 | low | 2100 € |  | Ayşe Demir |
| c142 Recipes ratings | planned | P1 |  | 1900 € | low | Mert Kaya |
| c121 Stall opening hours catalogue | building |  | low | 1700 € |  | Ayşe Demir |
| c124 Stall reviews reminder | idea | P2 | low | 1700 € |  | Jonas Weber |
| c98 Pickup slots pickup slots | planned | P3 |  | 1500 € |  |  |
| c117 Leftover produce map |  |  |  | 1200 € | low |  |
| c103 The weekly basket catalogue |  |  | low | 1000 € | high | Ayşe Demir |
| c125 Cheese reminder | idea | P2 | medium | 900 € | high |  |
| c99 Prices pickup slots | building | P2 | medium | 600 € | high | Ayşe Demir |
| c109 Cheese map | building | P1 | high | 400 € |  |  |
| c116 Leftover produce dashboard |  |  | low | 300 € |  |  |
| c123 Pickup slots checkout |  | P2 | medium | 200 € | high |  |
| c105 Bread chat |  | P1 | medium |  | medium |  |
| c97 Bread pickup slots |  |  | medium |  |  |  |
| c145 Bread ratings |  |  | medium |  | low |  |
| c144 Cheese catalogue | shipped |  | low |  |  | Ayşe Demir |
| c143 Cheese ratings |  |  | low |  | low |  |
| c126 Loyalty stamps chat | shipped | P3 | medium |  |  |  |
| c115 Loyalty stamps price list |  | P3 | medium |  |  |  |
| c108 Market maps map | idea | P1 |  |  |  |  |
</workspace_content>
Rows 1–25 of 39 (page 1/2). Next: page 2.
[more: Rows 1–25 of 39 (page 1/2). Next: page 2.]

=== view(p14) · kanban (cards)
# p14 deck "Priorities" · holds cards: 32 cards by effort × impact (type is feature or package)
<workspace_content author="workspace">
## effort no value × impact no value (3)
- c107 · feature · "The weekly basket onboarding" · P2 · shipped
- c127 · package · "Cheese bundle" · holds 4 features
- c128 · package · "Loyalty stamps bundle" · holds 6 features
## effort S × impact no value (1)
- c117 · feature · "Leftover produce map" · effort S · ☐ 0/1
## effort M × impact no value (1)
- c108 · feature · "Market maps map" · P1 · idea · effort M
## effort L × impact no value (3)
- c98 · feature · "Pickup slots pickup slots" · P3 · planned · effort L · ☐ 0/1
- c120 · feature · "Stall opening hours reminder" · P2 · idea · effort L
- c119 · feature · "Stall reviews price list" · P3 · planned · effort L
## effort no value × impact high (1)
- c101 · feature · "Stall reviews pickup slots" · building · impact high
## effort S × impact high "quick wins" (1)
- c113 · feature · "Stall opening hours pickup slots" · P3 · building · impact high · effort S · ☐ 0/1
## effort M × impact high (2)
- c109 · feature · "Cheese map" · P1 · building · impact high · effort M
- c102 · feature · "Seasonal boxes dashboard" · shipped · impact high · effort M · ☐ 0/1
## effort L × impact high "big bets" (1)
- c114 · feature · "Seasonal boxes push alerts" · P1 · planned · impact high · effort L
## effort no value × impact medium (4)
- c97 · feature · "Bread pickup slots" · impact medium · ☐ 1/2
- c122 · feature · "Leftover produce checkout" · impact medium
- c115 · feature · "Loyalty stamps price list" · P3 · impact medium · ☐ 1/2
- c99 · feature · "Prices pickup slots" · P2 · building · impact medium · ☐ 0/1
## effort S × impact medium (1)
- c125 · feature · "Cheese reminder" · P2 · idea · impact medium · effort S · ☐ 0/1
## effort M × impact medium (4)
- c123 · feature · "Pickup slots checkout" · P2 · impact medium · effort M · ☐ 0/1
- c126 · feature · "Loyalty stamps chat" · P3 · shipped · impact medium · effort M · ☐ 0/1
- c105 · feature · "Bread chat" · P1 · impact medium · effort M · ☐ 0/1
- c112 · feature · "Market maps chat" · P3 · impact medium · effort M
## effort L × impact medium (1)
- c110 · feature · "Recipes QR codes" · building · impact medium · effort L · ☐ 1/3
## effort no value × impact low (3)
- c104 · feature · "Prices push alerts" · P1 · impact low
- c111 · feature · "Recipes reminder" · P2 · idea · impact low
- c103 · feature · "The weekly basket catalogue" · impact low
## effort S × impact low "fill-ins" (1)
- c100 · feature · "Stall opening hours price list" · P1 · impact low · effort S · ☐ 1/2
## effort M × impact low (3)
- c121 · feature · "Stall opening hours catalogue" · building · impact low · effort M
- c118 · feature · "Stall reviews checkout" · shipped · impact low · effort M · ☐ 0/1
- c124 · feature · "Stall reviews reminder" · P2 · idea · impact low · effort M · ☐ 0/2
## effort L × impact low "money pits" (2)
- c116 · feature · "Leftover produce dashboard" · impact low · effort L · ☐ 1/4
- c106 · feature · "Market maps ratings" · P1 · building · impact low · effort L · ☐ 0/1
</workspace_content>

=== view(p15) · timeline
# p15 timeline "Schedule" · days of p13 · 21 tasks with days · rows by kanban · today 2026-11-03
<workspace_content author="workspace">
## p13 "Sprint" (21)
- 2026-10-15 → 2026-10-16 (late) · t41 · "Ship Saturday pilot" · → u2 Jonas Weber · for c110 "Recipes QR codes"
- ◆ 2026-10-19 (late) · t52 · "Map five stall owners" · → u2 Jonas Weber · for c106 "Market maps ratings" · P2 · ☐ 1/2 · #berlin
- 2026-10-19 → 2026-10-29 (late) · t34 · "Ship the stall onboarding" · → u3 Mert Kaya · for c116 "Leftover produce dashboard"
- ◆ 2026-10-20 (late) · t54 · "Price the pickup flow" · for c102 "Seasonal boxes dashboard"
- ◆ 2026-10-22 (late) · t46 · "Visit the Kreuzberg market" · ☐ 4/4
- 2026-10-25 → 2026-10-29 ✓ · t58 · "Write Saturday pilot" · → u1 Ayşe Demir · for c110 "Recipes QR codes" · ☐ 3/4 · #istanbul
- ◆ 2026-10-31 (late) · t44 · "Test the WhatsApp bot" · → u3 Mert Kaya · for c125 "Cheese reminder" · #pricing
- ◆ 2026-10-31 (late) · t27 · "Ship three restaurants" · → u3 Mert Kaya
- ◆ 2026-11-02 (late) · t45 · "Test the Kreuzberg market" · for c116 "Leftover produce dashboard"
- 2026-11-04 → 2026-11-14 · t47 · "Draft the WhatsApp bot" · → u3 Mert Kaya · ☐ 1/2
- ◆ 2026-11-07 · t25 · "Call the stall onboarding" · for c113 "Stall opening hours pickup slots"
- 2026-11-09 → 2026-11-12 ✓ · t59 · "Visit the WhatsApp bot" · → u1 Ayşe Demir · P3 · #b2c
- 2026-11-10 → 2026-11-18 · t30 · "Test three restaurants" · → u1 Ayşe Demir
- 2026-11-16 → 2026-11-23 ✓ · t56 · "Test the pickup flow" · → u3 Mert Kaya · for c116 "Leftover produce dashboard"
- 2026-11-17 → 2026-11-24 · t38 · "Call the landing page" · → u1 Ayşe Demir · for c105 "Bread chat" · P2
- 2026-11-22 → 2026-12-01 · t48 · "Design the pickup flow" · → u3 Mert Kaya · P2 · ☐ 1/3
- 2026-11-29 → 2026-12-09 · t36 · "Price Saturday pilot" · → u1 Ayşe Demir · for c100 "Stall opening hours price list"
- ◆ 2026-12-04 · t29 · "Price Saturday pilot" · → u2 Jonas Weber · for c117 "Leftover produce map" · ☐ 2/4
- 2026-12-06 → 2026-12-11 · t33 · "Map the WhatsApp bot" · ☐ 0/2
- ◆ 2026-12-09 · t24 · "Design the Kreuzberg market"
- ◆ 2026-12-11 · t51 · "Interview the Kreuzberg market" · for c97 "Bread pickup slots"
## no day yet (19)
- t21 · "Map the stall onboarding" · ☐ 2/4
- t22 · "Design the WhatsApp bot" · → u3 Mert Kaya · ☐ 1/3
- t31 · "Design Saturday pilot" · P2
- t23 · "Draft five stall owners" · → u2 Jonas Weber · #istanbul
- t32 · "Map the order email" · → u3 Mert Kaya · #b2c
- t55 · "Map five stall owners" · → u2 Jonas Weber · for c97 "Bread pickup slots" · ☐ 3/4
- t35 · "Write five stall owners" · → u1 Ayşe Demir · for c123 "Pickup slots checkout" · P1
- t37 · "Ship the order email" · P3
- t26 · "Map the order email" · → u1 Ayşe Demir · for c99 "Prices pickup slots"
- t57 · "Call three restaurants" · → u2 Jonas Weber · for c115 "Loyalty stamps price list"
- t49 · "Map the order email" · → u2 Jonas Weber · for c124 "Stall reviews reminder"
- t28 · "Map the landing page" · → u3 Mert Kaya · for c116 "Leftover produce dashboard" · P2
- t39 · "Visit the stall onboarding" · → u1 Ayşe Demir · for c115 "Loyalty stamps price list"
- t50 · "Test the pickup flow" · → u2 Jonas Weber · for c118 "Stall reviews checkout"
- t40 · "Draft Saturday pilot" · → u3 Mert Kaya · for c98 "Pickup slots pickup slots" · P1 · #supply
- t53 · "Draft the Kreuzberg market" · → u3 Mert Kaya · #b2c
- t42 · "Test the stall onboarding" · for c110 "Recipes QR codes"
- t60 · "Ship the order email" · → u3 Mert Kaya · P1 · ☐ 0/2 · #b2c
- t43 · "Map three restaurants" · → u1 Ayşe Demir · for c126 "Loyalty stamps chat" · P2
</workspace_content>

=== view(p11) · matrix, criteria open
# p11 matrix "Feature coverage"
35 rows (features: every feature on p9, criteria unfolded) × 10 columns (competitors: every competitor (4 taken out)) · cells: scale none/partial/full/better · 192 filled
Cells: scale ○ none < ◐ partial < ● full < ★ better · — not relevant · ~ inferred, ? a guess · empty = not filled
<workspace_content author="workspace">
| features \ competitors | c37 Bazaarcart | c38 Bazaarmate | c44 Bazaarrun | c36 Freshgo | c39 Hasatclub | c41 Hasatdrop | c40 Localrun | c35 Marketclub | total |
|---|---|---|---|---|---|---|---|---|---|
| c105 Bread chat |  |  |  | ★ better ~ | ◐ partial |  | ○ none | ◐ partial | 1 none · 2 partial · 1 full · 2 better |
| c97 Bread pickup slots · ◇ 1 open | ◐ partial (from criteria) | — | ◐ partial (from criteria) | ○ none (from criteria) | ○ none (from criteria) | ● full (from criteria) | ● full (from criteria) | ● full | 4 none · 2 partial · 3 full |
| ↳ stall can update it ◇ open | ◐ partial | ○ none |  | ○ none | ○ none |  |  |  |  |
| ↳ shows stock | ◐ partial | ○ none | ◐ partial | ○ none | ○ none | ● full | ● full |  |  |
| c109 Cheese map | ● full |  |  | ● full | ● full | ★ better | ● full | ◐ partial | 1 none · 1 partial · 5 full · 1 better |
| c125 Cheese reminder |  |  |  | ● full | ◐ partial | ★ better ~ |  | ○ none | 1 none · 1 partial · 1 full · 1 better |
| c122 Leftover produce checkout | ★ better | ◐ partial | ◐ partial ? |  | ● full |  |  | ● full | 2 partial · 2 full · 3 better |
| c116 Leftover produce dashboard |  |  | ● full |  | ○ none *1 | ● full | ● full |  | 1 none · 3 full · 1 better |
| c117 Leftover produce map |  | ● full | ● full |  |  | ● full |  | ◐ partial | 1 none · 1 partial · 3 full |
| c126 Loyalty stamps chat | ● full | ● full | ○ none | ★ better |  |  | — |  | 1 none · 1 partial · 2 full · 1 better |
| c115 Loyalty stamps price list |  | ○ none | ◐ partial | ★ better ~ *2 |  |  | ● full | ○ none *3 | 3 none · 1 partial · 1 full · 1 better |
| c112 Market maps chat | ★ better |  | ● full | ◐ partial |  | ● full | ● full | ● full | 1 partial · 4 full · 1 better |
| c108 Market maps map |  |  |  |  | ★ better |  | ○ none | ○ none | 2 none · 1 full · 1 better |
| c106 Market maps ratings |  |  | ★ better | ★ better ? | ● full |  | ◐ partial |  | 1 partial · 1 full · 2 better |
| c123 Pickup slots checkout |  | ★ better |  |  |  | ○ none |  |  | 2 none · 1 full · 1 better |
| c98 Pickup slots pickup slots |  | ● full | ◐ partial |  | ★ better |  | ◐ partial | ◐ partial | 3 partial · 1 full · 2 better |
| c99 Prices pickup slots | ◐ partial (from criteria) | ○ none (from criteria) | ● full (from criteria) | ◐ partial (from criteria) ? | ◐ partial (from criteria) | ◐ partial (from criteria) | ○ none (from criteria) | ● full (from criteria) | 2 none · 6 partial · 2 full |
| ↳ no account needed | ● full |  |  | ● full | ○ none | — | ◐ partial |  |  |
| ↳ works offline | ◐ partial |  | ● full ~ |  | ● full |  | ○ none | ● full |  |
| ↳ Turkish and German | ○ none | ○ none | ● full | ○ none | ● full | ◐ partial | — | ● full |  |
| c104 Prices push alerts |  |  |  |  | ◐ partial | ○ none |  |  | 2 none · 1 partial |
| c110 Recipes QR codes | ★ better |  |  |  | ● full | ★ better |  | ● full | 3 full · 3 better |
| c111 Recipes reminder |  |  |  | ★ better | ★ better |  |  |  | 4 better |
| c102 Seasonal boxes dashboard |  |  | ● full | ◐ partial ? |  |  | ★ better |  | 1 partial · 1 full · 1 better |
| c114 Seasonal boxes push alerts |  | ● full ~ | ● full |  |  |  | ● full |  | 3 full |

Notes:
*1 c116 Leftover produce dashboard × c39 Hasatclub: Would pay 2 € more to skip the queue
*2 c115 Loyalty stamps price list × c36 Freshgo: Came back three Saturdays in a row after the reminder
*3 c115 Loyalty stamps price list × c35 Marketclub: Bought the same basket four weeks running
</workspace_content>
Rows 1–25 of 35 (page 1/2). Next: page 2. Columns 1–8 of 10 (col_page 1/2). Next: col_page 2.
[more: Rows 1–25 of 35 (page 1/2). Next: page 2. Columns 1–8 of 10 (col_page 1/2). Next: col_page 2.]

=== query({kind:"comment"})
query comment threads: 8 (today 2026-11-03)
<workspace_content author="workspace">
m8 on c23 "Office lunch groups sell out by 10am an…" · open · 2 messages · last Lea Hoffmann 2026-07-24: "Agreed, moving it to testing."
m7 on c38 "Bazaarmate" · resolved · 3 messages · last Ayşe Demir 2026-07-24: "I think this belongs on Bets."
m6 on c7 "Organic farmers in Beşiktaş" · open · 4 messages · last Ayşe Demir 2026-07-24: "Is this still true after the pilot?"
m5 on c131 "Students near the tram (core)" · resolved · 3 messages · last Lea Hoffmann 2026-07-24: "Let us price this first."
m4 on c17 "Young parents can't take card payments" · open · 1 message · last Mert Kaya 2026-07-24: "Agreed, moving it to testing."
m3 on c138 "Share stall opening hours every Friday" · open · 2 messages · last Mert Kaya 2026-07-23: "Agreed, moving it to testing."
m2 on c37 "Bazaarcart" · open · 2 messages · last Mert Kaya 2026-07-23: "Who talked to them?"
m1 on c16 "Bakers carry heavy bags home on foot" · open · 4 messages · last Lea Hoffmann 2026-07-23: "Is this still true after the pilot?"
</workspace_content>

=== get([c1], full)
<workspace_content author="workspace">
## c1 · customer · "Retired regulars near the tram" · invalidated +0 −1
on p1 "Segments" (home), p9 "Roadmap"
evidence (1):
- v1 − contradicts · observation · "Came back three Saturdays in a row after the reminder" · WhatsApp group screenshot · 2026-09-11
links (2):
- ← for from c107 feature "The weekly basket onboarding" [e130]
- → contradicts c106 feature "Market maps ratings" [e240]
shown in: p5 matrix "Pain map"
</workspace_content>

=== search("cash")
search "cash": 20 matches
<workspace_content author="workspace">
## in p1 plane "Segments"
- c9 · customer · "Organic farmers who pay cash" · validated !
- c14 · customer · "Students who pay cash (early)" · testing
- x5 sticky "Cash only is a big deal" by Ayşe Demir
- c5 · customer · "Stall owners new to the city" · validated ! · #trust — Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it.
- c17 · problem · "Young parents can't take card payments" · testing — Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it.
## in p10 plane "Pricing"
- c129 · customer · "Restaurant buyers who pay cash (core)" · hypothesis
- c134 · idea · "Map recipes at a discount" · testing +1 −1 — Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it.
- c143 · feature · "Cheese ratings" · impact low · effort M · #berlin — Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it.
## in p2 plane "Rivals"
- x8 sticky "Cash only is a big deal" by Ayşe Demir
- x9 sticky "Cash only is a big deal" by Jonas Weber
- x10 paragraph "Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it."
## in p3 plane "Bets"
- c58 · idea · "Pre-order bread for pickup" · hypothesis — Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it.
- c76 · idea · "Remind about cheese from the stall" · invalidated ! — Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it.
## in p9 plane "Roadmap"
- c108 · feature · "Market maps map" · P1 · idea · effort M — Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it.
## in p13 deck "Sprint"
- t30 · "Test three restaurants" · → u1 Ayşe Demir · from 2026-11-10 due 2026-11-18 — Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it.
## in p6 deck "Research"
- t12 · "Write Saturday pilot" · → u1 Ayşe Demir · #pricing — Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it.
## documents
- d4 markdown "Competitor teardown" · by Ayşe Demir — …ards Numbers Most stalls run on cash and WhatsApp; anything we build has to fit that before it r…
- d3 markdown "Pilot week 2 report" · by Jonas Weber — …he reminder. Most stalls run on cash and WhatsApp; anything we build has to fit that before it r…
- d2 markdown "Pricing research" · by Jonas Weber — …p the queue. Most stalls run on cash and WhatsApp; anything we build has to fit that before it r…
- d1 markdown "Interview notes — stall owners" · by Mert Kaya — …eens a week. Most stalls run on cash and WhatsApp; anything we build has to fit that before it r…
</workspace_content>

=== query({"type":"problem","status":"validated"})
query cards where type problem, status validated: 5 (today 2026-11-03)
<workspace_content author="workspace">
c22 · problem · "Organic farmers have no way to reserve the last loaves" · validated +1 −1 · for c3 · ←solves c137 c59 c67 c57 · ←competes-with c47
c23 · problem · "Office lunch groups sell out by 10am and turn people away" · validated +2 −1 · for c6
c33 · problem · "Retired regulars never know prices before they arrive" · validated +2 −0 · ←solves c140
c87 · problem · "Organic farmers pay too much at the supermarket instead" · validated ! · for c12 c85 c13
c91 · problem · "Restaurant buyers wait in long queues at the cheese stall" · validated +2 −1 · #b2b #b2c · ←solves c67 c62 c138 · ←competes-with c39 c41
</workspace_content>

=== neighbours(c1, depth 2)
neighbours of c1 (depth 2): 17
<workspace_content author="workspace">
c1 · customer · "Retired regulars near the tram" · invalidated +0 −1 · ⧉ on p1 "Segments", p9 "Roadmap"
## depth 1 (4)
- ← for: c107 · feature · "The weekly basket onboarding" · P2 · shipped
- → contradicts: c106 · feature · "Market maps ratings" · P1 · building · impact low · effort L · ☐ 0/1
- on plane: p1 plane "Segments" · 33 cards (14 customer, 16 problem, 3 feature) · 4 texts
- on plane: p9 plane "Roadmap" · 33 cards (30 feature, 2 package, 1 customer) · 3 texts
## depth 2 (13)
- c107 → inspired-by: c71 · idea · "Share market maps the night before" · testing
- c107 → inspired-by: c63 · idea · "Bundle the weekly basket the night before" · invalidated !
- c107 → part-of: c101 · feature · "Stall reviews pickup slots" · building · impact high
- c107 → inspired-by: c137 · idea · "Swap stall reviews in one tap" · testing
- c107 → inspired-by: c62 · idea · "Deliver bread at a discount" · invalidated +0 −1
- c107 in package: c128 · package · "Loyalty stamps bundle" · holds 6 features
- c106 → inspired-by: c66 · idea · "Bundle market maps for pickup" · hypothesis
- c106 → for: c10 · customer · "Young parents without a car" · invalidated +1 −0 !
- c106 → inspired-by: c76 · idea · "Remind about cheese from the stall" · invalidated !
- c106 task for it: t52 · "Map five stall owners" · → u2 Jonas Weber · due 2026-10-19 (overdue) · for c106 "Market maps ratings" · P2 · ☐ 1/2 · #berlin
- p1 stuck to it: p5 matrix "Pain map" · stuck to p1 · 14 rows (problems: every problem on p1 (2 taken out)) × 8 columns (customers: every customer on p1 (6 taken out)) · cells: scale low/medium/high · 73 filled
- p9 stuck to it: p13 deck "Sprint" · stuck to p9 · 40 tasks: todo 10 · doing 13/5 · review 11 · done ✓ 6 · 8 overdue
- p9 stuck to it: p14 deck "Priorities" · stuck to p9 · holds cards: 32 cards by effort × impact (type is feature or package)
</workspace_content>

=== read_document(d1, section "Summary")
# d1 markdown "Interview notes — stall owners" · by Mert Kaya · 326 words
<workspace_content author="Mert Kaya">
16│ ## Summary
17│ 
18│ The pilot showed that pre-orders cut waste more than they lift sales. Lead with waste. Said she throws away 4 crates of greens a week.
19│ Restaurants buy in bulk early in the morning; they are a different product from weekend shoppers. Said she throws away 4 crates of greens a week.
20│ Most stalls run on cash and WhatsApp; anything we build has to fit that before it replaces it. Would pay 2 € more to skip the queue.
21│ 
</workspace_content>
Lines 16–21 of 35. Next: range "22-35", or a section by its heading.
[more: Lines 16–21 of 35. Next: range "22-35", or a section by its heading.]

=== whats_new(NOW − 2 days)
whats_new since 2026-11-01 12:00: 7 changes. Who changed a card is not known here (no change log loaded).
<workspace_content author="workspace">
## documents · documents
- changed 2026-11-03 02:00 · d2 markdown "Pricing research"
## cards · p3 "Bets"
- changed 2026-11-03 01:00 · c67 · idea · "Share stall opening hours from the stall" · invalidated +1 −2
- changed 2026-11-02 13:00 · c57 · idea · "Pre-order market maps at a discount" · hypothesis
## tasks · p6 "Research"
- changed 2026-11-02 20:00 · t12 · "Write Saturday pilot" · → u1 Ayşe Demir · #pricing
- changed 2026-11-02 00:00 · t10 · "Call the Kreuzberg market" · P1
## tasks · p13 "Sprint"
- changed 2026-11-01 22:00 · t60 · "Ship the order email" · → u3 Mert Kaya · P1 · ☐ 0/2 · #b2c
## cards · p4 "Interviews"
- changed 2026-11-01 14:00 · c96 · problem · "Stall owners have no way to reserve the last loaves" · hypothesis
</workspace_content>

=== where_am_i(focus on the first plane, a card picked, its panel open)
## Where the person is now
canvas: k1 "Discovery"
in focus: p1 plane "Segments" · 33 cards (14 customer, 16 problem, 3 feature) · 4 texts
selected (1): c1 (in full below)
panel open: c1 (selected, below)
<workspace_content author="workspace">
## c1 · customer · "Retired regulars near the tram" · invalidated +0 −1
on p1 "Segments" (home), p9 "Roadmap"
evidence (1):
- v1 − contradicts · observation · "Came back three Saturdays in a row after the reminder" · WhatsApp group screenshot · 2026-09-11
links (2):
- ← for from c107 feature "The weekly basket onboarding" [e130]
- → contradicts c106 feature "Market maps ratings" [e240]
shown in: p5 matrix "Pain map"
</workspace_content>
