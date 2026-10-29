# North Star

A visual, real-time collaborative workspace for the startup ideation phase. Customers, problems,
competitors, ideas and features as cards on planes, linked and compared in matrices, tables, decks and
timelines on one canvas, rendered in a 3D ASCII aesthetic.

- Product: [docs/PRODUCT.md](docs/PRODUCT.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Design language: [docs/DESIGN.md](docs/DESIGN.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Current state, decisions and open questions: [memory-bank/](memory-bank/README.md)

Status: 1.5, live at <https://atahankilc.github.io/north-star/>. See [memory-bank/state.md](memory-bank/state.md).

## Develop

```sh
npm install
cp .env.example .env.local   # fill in the VITE_FIREBASE_* values
npm run dev                  # http://localhost:5288/
```

Without Firebase config the UI still runs (sign-in disabled), which is handy for design work.

### Local emulators (no real data touched)

```sh
npm run emulators      # terminal 1: auth, Firestore, RTDB, UI at http://localhost:4000
npm run dev:emu        # terminal 2: app with test sign-in buttons (Alice / Bob / Carol)
npm run test:rules     # one-off: security-rule tests (starts and stops its own emulators)
npm test               # unit tests (vitest); npm run lint counts React hook warnings
npm run deploy:rules   # push the Firestore rules + indexes and database.rules.json to north-star-db (ask first, D-322)
```

## Setup (one-time, Firebase free "Spark" plan, no card)

1. **Project**: <https://console.firebase.google.com> → *Add project* (ours: `north-star-db`). Analytics can be off.
2. **Web app**: Project settings → *Your apps* → Web (`</>`) → register `north-star`. Copy the config
   values into `.env.local` (`VITE_FIREBASE_*`). They are public by design; security lives in the rules files.
3. **Auth**: Build → Authentication → *Get started* → Sign-in method → **Google** → enable.
   Settings → *Authorized domains* → add `atahankilc.github.io` (localhost is there by default).
4. **Firestore**: Build → Firestore Database → *Create database* → production mode, pick a region.
5. **Realtime Database**: Build → Realtime Database → *Create database* → locked mode. Copy its URL
   into `VITE_FIREBASE_DATABASE_URL`.
6. **Rules**: `npx firebase-tools login`, then
   `npx firebase-tools deploy --only firestore:rules,database --project <project-id>`.
7. **GitHub Pages**: repo → Settings → Pages → Source: *GitHub Actions*. Then Settings → Secrets and
   variables → Actions → **Variables**: add the six `VITE_FIREBASE_*` values (API key, auth domain, project id, database URL, app id, storage bucket).
   Every push to `main` deploys to `https://atahankilc.github.io/<repo-name>/`. The base path follows the repo name automatically.
