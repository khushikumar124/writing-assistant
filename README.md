# Writing Assistant

A quiet workspace for people who write around a day job.

Most writing dies in the gap between having an idea and sitting down to write
it. This app is built for that gap: catch the mess, build pieces out of it, and
keep track of what actually shipped.

**No AI writes for you here.** Every prompt in the app was written by a person.
Nothing suggests your next sentence, rewrites your paragraph, or reads your
drafts to make recommendations.

## The loop

| Layer | What it does |
| --- | --- |
| **Capture** | ⌘K from any page, the OS share sheet on mobile, and offline — captures queue locally and sync when you reconnect. |
| **Forge** | Select several scattered thoughts and merge them into one idea. They stay linked and sit beside you in the editor as raw material. |
| **Shape** | A distraction-free editor with autosave, word count, and a thought rail you can insert from. |
| **Habit** | Streaks counted from words actually added, not from saves. |
| **Ship** | Mark a piece published with its link and date. It lands on your shelf, optionally public at `/@handle`. |

## Running it

```bash
npm install && npm run setup && npm run dev
```

`npm run setup` applies migrations and seeds a development account
(`dev@writingassistant.local` / `devpassword`). The app is then at
http://localhost:3000.

Copy `.env.example` to `.env` first if you want sessions to survive a server
restart — without `SESSION_SECRET`, development generates a fresh one on every
boot and signs you out.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server, API and client on one origin |
| `npm run build` | Builds the client and bundles the server to `dist/` |
| `npm start` | Runs the production build |
| `npm test` | Vitest |
| `npm run check` | TypeScript, no emit |
| `npm run db:generate` | Generates a migration from schema changes |
| `npm run db:migrate` | Applies migrations |
| `npm run db:reset` | Drops the database, re-migrates, re-seeds |

## Architecture

- **Client** — React 19, wouter, TanStack Query, Tailwind v4, shadcn/ui
- **API** — tRPC over Express, one origin, session in an httpOnly cookie
- **Data** — SQLite via Drizzle (WAL, foreign keys on)
- **Shared** — `shared/` holds domain vocabulary, streak maths, and the prompt
  library, imported by both sides without dragging Drizzle into the browser

### Things worth knowing before changing something

- **Deletes are soft.** Ideas and thoughts get a `deletedAt` and sit in the bin
  for 30 days. `deleteIdea`/`deleteThought` are the irreversible versions and
  are only reached from an explicit "delete forever".
- **Streaks count words added.** `drafts.save` diffs against the previous word
  count; a save that adds nothing logs no writing session. Otherwise opening a
  draft and fixing a typo would award a writing day.
- **The demo is a sandbox, not an account.** Each click of "try it without an
  account" mints a private throwaway user seeded from `server/sandbox.ts`,
  expiring after 24 hours. There is no shared demo login. Sandboxes cannot
  publish public shelves.
- **Curated prompts live in `shared/prompts.ts`,** under version control. Only
  a writer's own additions hit the `prompts` table.
- **Public shelves are opt-in and publish only shipped work** — titles, blurbs,
  links and dates. Draft prose, thoughts, and streaks are never exposed.
- **`/@handle` needs the dev-server rewrite** in `server/_core/vite.ts`; Vite
  claims `/@…` for its internal module ids. The client route is a regex, because
  wouter's path parser won't match a param behind a literal `@`.

## Signing in

Email + password, plus **Continue with Google** when `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are set (the button hides itself when they aren't).
Google accounts have no password until they ask for one through the reset link,
so `users.passwordHash` is nullable. A Google sign-in whose verified address
matches an existing account links to it rather than creating a duplicate.

## Deploying

Full walkthrough in [DEPLOY.md](DEPLOY.md) — including the Google Cloud console
steps, which only you can do.


Needs a persistent filesystem for the SQLite file — Fly.io with a volume,
Railway, or any VPS. It will not work on a serverless platform without moving
to a hosted database first.

Required in production:

- `SESSION_SECRET` — the server refuses to start without it
- `APP_URL` — so links in password reset emails point somewhere real
- `RESEND_API_KEY` — otherwise reset emails are logged to the console and
  nobody who forgets a password can get back in
- A volume mounted wherever `DATABASE_URL` points

Consider `DEMO_MODE=false` if you don't want anonymous visitors creating
sandbox accounts.
