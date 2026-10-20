# Archive (D-177)

The app before the canvas redesign (D-174): every page (board, focus, flow, table, matrix, priorities, overview,
reports), the assistant, export/import, and the data layer behind them (cards, links, matrix, planes, packages,
evidence, labels, threads, attachments, reports). It is kept out of the build (`tsconfig.json` excludes it; nothing
live imports it).

Paths mirror `src/`: `src/archive/views/canvas/Board.tsx` was `src/views/canvas/Board.tsx`. Files that stayed live but
were cut down (App.tsx, paths.ts, model.ts, workspaceData.ts, workspaces.ts, presence.ts, WorkspaceLayout.tsx,
context.ts, Settings.tsx, PeopleHere.tsx, Workspaces.tsx) have their full earlier version here too.

Features come back piece by piece, as pieces on the canvas: move (`git mv`) or copy what a piece needs out of here, make
it compile against today's code, and add it to the build. The data is still in older workspaces, `firestore.rules` and
`database.rules.json` still accept it, and deleting a workspace still removes all of it.
