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

- **A host account** — [fly.io](https://fly.io) is assumed below. `fly.toml`
  deploys to **US East (`iad`)**, the usual compromise for a worldwide
  audience. The volume must be created in the *same* region or the machine will
  not start. If most of your users end up in one place, see "Picking a region"
  below.
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

**Publish the consent screen before you share the link.** While it is in
*Testing*, only Google accounts you have explicitly added as test users can sign
in — everyone else gets an error, which for a Google-only app means nobody can
use the site. Publishing is a button in the console; with only the three scopes
above, Google does not require a verification review.

There is no email provider to set up: the app sends no mail. Google is the
only way to sign in, so there are no passwords to reset.

### For reminders (optional)

Generate a Web Push key pair once:

```bash
npm run keys:vapid
```

Set the three values it prints. **Never regenerate them on a live deploy** —
every existing subscription is signed against the old public key and would
silently stop being delivered. Without them the reminder settings show as
unavailable and nothing is scheduled; everything else works.

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
  GOOGLE_CLIENT_SECRET="..."
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

### Picking a region

The app runs as one machine, so every request from everywhere travels to that
one place. Rough round trips from `iad` (US East): ~20ms east coast US, ~90ms
west coast, ~90ms western Europe, ~230ms India, ~250ms Australia.

Alternatives: `fra` Frankfurt, `lhr` London, `sin` Singapore, `bom` Mumbai,
`syd` Sydney. Moving later means creating a volume in the new region and
copying `app.db` across — doable, but not a one-liner, so it is worth a moment
of thought now.

Genuinely global low latency needs read replicas (Fly's LiteFS) or a hosted
database, and neither is worth it before you have users in several continents
complaining.

---

## 3. Environment variables

| Variable | Required | What happens without it |
| --- | --- | --- |
| `SESSION_SECRET` | **Yes** | Server refuses to start |
| `APP_URL` | **Yes** in prod | OAuth callback and email links point at localhost |
| `DATABASE_URL` | Set in `fly.toml` | Defaults to `./data/app.db`, which is *not* on the volume |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | **Yes** in practice | No way to sign in; only the sandbox button works |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | No | Reminders show as unavailable |
| `DEMO_MODE` | No | Set `false` to remove the sandbox button |
| `PORT` | No | Defaults to 3000 |

---

## 4. Testing the image locally

Run it against a real Docker volume, never a bind mount from macOS or Windows:

```bash
docker volume create wa-data
docker run --rm -p 3000:3000 -v wa-data:/data \
  -e SESSION_SECRET="$(openssl rand -base64 32)" \
  -e APP_URL="http://localhost:3000" \
  writing-assistant:test
```

Mounting a host folder (`-v ./data:/data`) looks like it works — the app starts,
writes land — but SQLite in WAL mode needs POSIX file locking that Docker
Desktop's macOS/Windows file sharing does not reproduce faithfully. Writes are
reported as successful and then quietly fail to materialise. It cost an hour of
chasing a deletion "bug" that did not exist. Fly volumes are real block devices,
so this affects local testing only.

---

## 5. Backups

The app takes its own snapshot on boot and daily, keeping seven in
`/data/backups` — that covers a bad migration or a delete gone wrong, but not
losing the volume itself, so pulling one off the machine is still worth doing.

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

## 6. Before you invite real users

- [ ] `SESSION_SECRET` set, and different from anything in `.env`
- [ ] `APP_URL` matches the real domain
- [ ] Google redirect URI matches `APP_URL` exactly
- [ ] Google consent screen **published**, not left in Testing
- [ ] Signed in with a Google account that is *not* yours, to prove it
- [ ] Volume mounted — confirm with `fly ssh console -C "ls -la /data"`
- [ ] A backup taken and *restored somewhere* to prove it works
- [ ] Decide on `DEMO_MODE`: sandboxes are unauthenticated writes to your disk
- [ ] Privacy note somewhere, since you now hold other people's unpublished work
- [ ] Account deletion tried once on a throwaway account
- [ ] If reminders are on: a test notification actually arrived
- [ ] A shelf link pasted somewhere, to confirm it unfurls with a real title

---

## Notes on what is not here

**Phone-number sign-in.** Deliberately not built, and the barrier is higher in
India than almost anywhere else.

Sending application-to-person SMS to Indian numbers requires **TRAI DLT
registration**: you register as a Principal Entity on a telecom operator's DLT
portal (Jio, Airtel, Vi, BSNL), then separately register your sender header and
*every message template*, each of which is reviewed before it can send. It
generally expects business documentation — GST or company PAN rather than a
personal one — plus a registration fee and a wait measured in days to weeks.
Unregistered traffic to Indian numbers is filtered by the operators, so this is
not a step that can be skipped.

The way around doing that yourself is a hosted identity provider that owns the
DLT relationship — Firebase Authentication being the obvious one — at a
per-verification cost and the price of a new dependency in the auth path.
Confirm current India pricing before committing; SMS pumping fraud has made
Indian verification traffic expensive and the terms move.

None of that is worth it here. This is a tool people use at a keyboard, and
Google sign-in already delivers the "no new password to remember" convenience
for free, with the highest Android share of any large market behind it. If it
ever becomes necessary, the shape is a `phone` column plus a one-time-code
table, and the existing rate limiter already has suitable buckets.

**Data protection (India).** Holding other people's unpublished writing brings
the DPDP Act 2023 into scope for Indian users. The main practical gaps today are
a published privacy notice and a self-service "delete my account" that actually
erases rather than soft-deletes. Worth closing before you promote this widely.

**Scaling past one machine.** The moment you want two, SQLite has to go. The
migration path is Postgres (Neon, Supabase, or Fly Postgres): Drizzle's query
builder mostly survives, but `server/db.ts` and every migration would be
rewritten. Don't do it before you need it.
