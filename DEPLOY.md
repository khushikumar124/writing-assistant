# Deploying Writing Assistant

The app is a single Node process serving both the API and the built client, with
SQLite on a local disk. That shapes every choice below.

**It needs a persistent filesystem.** Fly.io with a volume, Railway, Render with
a disk, or any VPS. It will *not* work on Vercel, Netlify, or Cloudflare Workers
without first moving to a hosted database — those platforms give each request a
fresh filesystem, so the database would vanish continuously.

**Run exactly one instance.** Two machines means two volumes means two divergent
databases, and nothing will warn you. `fly.toml` pins this deliberately.

---

## 1. Things only you can do

These need accounts in your name. Nobody else can create them for you.

### Required

- **A host account** — [fly.io](https://fly.io) is assumed below.
- **A session secret** — generate it locally:
  ```bash
  openssl rand -base64 32
  ```
  The server refuses to start in production without one. It signs session
  cookies: change it later and every user is logged out at once.

### For "Continue with Google"

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → create
   a project.
2. **APIs & Services → OAuth consent screen.** Choose *External*, fill in the
   app name, your support email, and a logo if you have one.
3. Add scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
   Nothing more — extra scopes trigger a Google review you don't need.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
5. Under *Authorised redirect URIs*, add **exactly**:
   ```
   https://YOUR-DOMAIN/api/auth/google/callback
   ```
   This must match `APP_URL` character for character, including `https://` and
   no trailing slash. A mismatch is the single most common cause of
   `redirect_uri_mismatch`.
6. Copy the client ID and client secret.

While the consent screen is in *Testing*, only accounts you list as test users
can sign in. Publishing it is a button in the console; for the scopes above,
Google does not require a verification review.

### For password reset emails

Sign up at [resend.com](https://resend.com), verify a sending domain, and take
an API key. **Without this, password resets silently go to the server log and
users who forget their password cannot get back in.** Google sign-in users are
unaffected.

---

## 2. Deploy to Fly

```bash
brew install flyctl && fly auth login
```

From the project root:

```bash
fly launch --no-deploy
```

When it offers to overwrite `fly.toml`, **say no** — the volume mount and
single-machine settings in the committed file are load-bearing.

Create the volume the database lives on (size it generously; text is small but
growing a volume later is more annoying than paying for 3GB now):

```bash
fly volumes create writing_data --size 3 --region iad
```

Set the secrets:

```bash
fly secrets set \
  SESSION_SECRET="paste-the-openssl-output" \
  APP_URL="https://your-app.fly.dev" \
  GOOGLE_CLIENT_ID="...apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="..." \
  RESEND_API_KEY="re_..." \
  MAIL_FROM="Writing Assistant <hello@yourdomain.com>"
```

Then:

```bash
fly deploy
```

Migrations run automatically at boot, so there is no separate migrate step.

### A custom domain

```bash
fly certs add yourdomain.com
```

Follow the DNS records it prints. Then **update two things or sign-in breaks**:

1. `fly secrets set APP_URL="https://yourdomain.com"`
2. Add `https://yourdomain.com/api/auth/google/callback` to the authorised
   redirect URIs in the Google console.

---

## 3. Environment variables

| Variable | Required | What happens without it |
| --- | --- | --- |
| `SESSION_SECRET` | **Yes** | Server refuses to start |
| `APP_URL` | **Yes** in prod | OAuth callback and email links point at localhost |
| `DATABASE_URL` | Set in `fly.toml` | Defaults to `./data/app.db`, which is *not* on the volume |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Google button is hidden; email/password still works |
| `RESEND_API_KEY` | No | Reset emails are logged to the console, not sent |
| `MAIL_FROM` | No | Falls back to Resend's shared test sender |
| `DEMO_MODE` | No | Set `false` to remove the sandbox button |
| `PORT` | No | Defaults to 3000 |

---

## 4. Backups

Fly volumes get daily snapshots, but a snapshot is not a backup you have tested.
For a text database this is small enough to just pull down:

```bash
fly ssh console -C "cat /data/app.db" > backup-$(date +%F).db
```

Do this before any deploy that includes a migration. SQLite in WAL mode may keep
recent writes in `app.db-wal`; for a consistent copy use:

```bash
fly ssh console -C "sqlite3 /data/app.db '.backup /data/backup.db'"
fly ssh sftp get /data/backup.db
```

---

## 5. Before you invite real users

- [ ] `SESSION_SECRET` set, and different from anything in `.env`
- [ ] `APP_URL` matches the real domain
- [ ] Google redirect URI matches `APP_URL` exactly
- [ ] `RESEND_API_KEY` set, and a password reset tested end to end
- [ ] Volume mounted — confirm with `fly ssh console -C "ls -la /data"`
- [ ] A backup taken and *restored somewhere* to prove it works
- [ ] Decide on `DEMO_MODE`: sandboxes are unauthenticated writes to your disk
- [ ] Privacy note somewhere, since you now hold other people's unpublished work

---

## Notes on what is not here

**Phone-number sign-in.** Deliberately not built. It needs an SMS provider
(Twilio et al), costs real money per message, and in the US requires A2P 10DLC
brand registration — days to weeks of paperwork before the first message sends.
For a writing tool the audience is at a keyboard with an email address; Google
sign-in covers the same "no new password" convenience for free. If you still
want it later, the shape is a `phone` column plus a one-time-code table, and the
existing rate limiter already has the right buckets.

**Scaling past one machine.** The moment you want two, SQLite has to go. The
migration path is Postgres (Neon, Supabase, or Fly Postgres): Drizzle's query
builder mostly survives, but `server/db.ts` and every migration would be
rewritten. Don't do it before you need it.
