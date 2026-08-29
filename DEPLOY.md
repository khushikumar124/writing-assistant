# Deploying Writing Assistant

**Vercel + Neon Postgres, both on free tiers.** No credit card, no monthly bill.

The app is a React SPA plus an Express API that runs as a single Vercel
serverless function, against a hosted Postgres database.

---

## 1. Things only you can do

Three accounts, all free, all in your name.

### Neon — the database

1. Sign up at [neon.com](https://neon.com). No card required.
2. Create a project. Any region — pick one near you.
3. Copy the **pooled** connection string: the one whose host contains
   `-pooler`. Serverless opens a connection per invocation, and the pooler is
   what stops that exhausting the database.

Free tier: 0.5GB storage, 100 compute-hours/month, permanent. The compute
suspends after five minutes idle and wakes on the next query, which adds a
fraction of a second to the first request after a quiet spell.

### Google — sign-in

Sign-in is Google-only, so **without this nobody can use the site** except
through the sandbox button.

1. [Google Cloud Console](https://console.cloud.google.com/) → create a project.
2. **APIs & Services → OAuth consent screen.** Choose *External*, fill in the
   app name and your support email.
3. Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
   Nothing more — extra scopes trigger a review you don't need.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
5. Authorised redirect URI, exactly:
   ```
   https://YOUR-PROJECT.vercel.app/api/auth/google/callback
   ```
   Character for character, including `https://` and no trailing slash. A
   mismatch is the most common cause of `redirect_uri_mismatch`.

**Publish the consent screen before sharing the link.** While it is in
*Testing*, only accounts you list as test users can sign in — which, for a
Google-only app, means nobody.

### Vercel — the hosting

Sign up at [vercel.com](https://vercel.com) with your GitHub account.

---

## 2. Deploy

Push this repository to GitHub, then on Vercel: **Add New → Project → import
it**. The framework preset should be detected from `vercel.json`; leave the
build settings alone.

Before the first deploy, add the environment variables under
**Settings → Environment Variables**:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon's **pooled** connection string |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `APP_URL` | `https://YOUR-PROJECT.vercel.app` |
| `GOOGLE_CLIENT_ID` | from the Google console |
| `GOOGLE_CLIENT_SECRET` | from the Google console |
| `CRON_SECRET` | any random string |
| `VAPID_PUBLIC_KEY` | `npm run keys:vapid` (optional) |
| `VAPID_PRIVATE_KEY` | same command (optional) |
| `VAPID_SUBJECT` | `mailto:you@yourdomain.com` (optional) |

Then deploy. The build runs `vite build` and applies migrations, so there is no
separate migration step.

`APP_URL` is a chicken-and-egg: you need the deployed URL to set it. Deploy
once, copy the URL Vercel gives you, set `APP_URL` and the Google redirect URI
to match, and redeploy.

---

## 3. What serverless costs you

**Reminders are coarser.** Vercel's Hobby plan runs cron **once per day, in UTC,
and may fire anywhere within the scheduled hour**. So:

- *Daily* reminders work, but arrive at roughly 09:00 UTC rather than 09:00
  where the reader is.
- *Weekly*, *monthly* and *custom weekday* schedules work, on the right days.
- A user's chosen **time of day is not honoured**. The schedule logic still
  checks it, so a reminder set for 23:00 local simply will not fire on a
  once-daily UTC tick.

If precise reminder times matter more than the hosting bill, that needs an
always-on process — a small VM, or Vercel's paid plan for finer cron.

**No local disk.** Backups are Neon's problem now, which is an improvement:
their free tier keeps point-in-time history, and the old file-copy backups are
gone from the codebase.

---

## 4. Running it locally

You need a Postgres. Either point `DATABASE_URL` at your Neon database (simple,
but development shares production data — fine before launch, bad after), or run
one locally:

```bash
brew install postgresql@16 && brew services start postgresql@16
createdb writing
```

```bash
npm install && npm run db:migrate && npm run dev
```

Click **Try it without an account** for a sandbox with sample writing; no Google
credentials needed to develop.

---

## 5. Before you share the link

- [ ] Google consent screen **published**, not left in Testing
- [ ] Signed in with a Google account that is *not* yours, to prove it works
- [ ] `APP_URL` matches the deployed URL, and the redirect URI matches it exactly
- [ ] A shelf link pasted somewhere, to confirm it unfurls with a real title
- [ ] Account deletion tried once on a throwaway account
- [ ] Decide on `DEMO_MODE`: sandboxes are unauthenticated writes to your database

---

## Notes

**Why not SQLite.** The app used to run SQLite on a mounted disk, which needs a
host with a persistent filesystem — Fly, Railway, a VPS — and those cost money.
Vercel gives each request a fresh filesystem, so the database had to move
off-disk. That is the whole reason for the Postgres migration.

**Scaling.** Neon's free tier suspends after five minutes idle; the first
request after that pays a small wake-up cost. If the project ever outgrows
0.5GB or 100 compute-hours a month, that is a paid-tier conversation, not a
re-architecture.
