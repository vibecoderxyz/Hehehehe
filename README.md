# CIPHER BVG

Website panel for WhatsApp device pairing, a command terminal, and UID-based
premium membership. Matte-black / charcoal surfaces with thin amber accents and
silver typography. Mobile-first, with a fixed bottom navigation
(PAIR · CMD · OWNER · profile).

**This is a website.** It runs on any Node.js host and is opened in a browser at
`http://<host>:<PORT>`. There is no APK and no Android build step.

---

## 1. Requirements

| Item | Version |
|---|---|
| Node.js | 18 LTS or newer (20 recommended) |
| npm | bundled with Node |
| OS | Linux VPS (Debian/Ubuntu tested), also runs on Windows/macOS |
| Port | `PORT` env var, default `2024` |

---

## 2. Install

```bash
cd sunrako
npm install
```

`npm install` pulls Express, Telegraf and the WhatsApp engine
(`@whiskeysockets/baileys`). It is the only heavy step and may take a few minutes.

If the WhatsApp engine fails to install, the panel **still boots** — the PAIR and
CMD sections show a notice, and informational commands keep working.

---

## 3. Configure before first run

All runtime configuration is read from environment variables. For local runs you
can copy the template into a `.env` file — it is read automatically on boot:

```bash
cp .env.example .env
```

`.env` is git-ignored. Real environment variables always win over `.env` values,
so on Railway / Katabump / Pterodactyl you set the same names in the panel's env
section and the `.env` file (if any) is simply not needed.

| Variable | Required | Purpose |
|---|---|---|
| `BOT_TOKEN` | for the bot | Telegram bot token from @BotFather. Empty = panel runs, bot stays offline. |
| `OWNER_ID` | for the bot | Your numeric Telegram user id (from @userinfobot). |
| `PORT` | no | HTTP port. Defaults to `2024`; most hosts inject this. |
| `TRUST_PROXY` | behind a proxy | Set `1` only when a trusted proxy (Railway, Nginx, Cloudflare, wings) sits in front. |
| `PANEL_ORIGIN` | no | One extra allowed CORS origin. Leave unset for same-origin. |
| `BANNER_TELEGRAM` | no | Photo used by the bot's `/start` command. |
| `BANNER_DASHBOARD` / `BANNER_LOGIN` | no | Reserved. The web pages ship their own local `Assets/` images, so these are currently not read. |

`Database/config.js` reads these at boot and falls back to the shipped defaults,
so an install without any env vars still starts.

### 3.1 Session pepper — auto-generated, keep the file

Leave `config.json` → `security.pepper` **empty** (the default). On first boot a
random 32-byte pepper is generated and written to `Database/.pepper` with mode
`0600`, and it is reused on every later start.

- Back up `Database/.pepper` with your data. If it is lost, every existing
  password stops matching and all users must reset.
- If you prefer to manage it yourself, set `security.pepper` to a long random
  string instead. Never reuse the old placeholder value.
- The pepper is mixed into every password hash, so changing it invalidates all
  existing passwords.

### 3.2 Owner contact details

`Database/owner.json` holds the only data shown in the OWNER section. Current
values are real (`S7xShamrez`, `t.me/S7xShamrez`, `t.me/Shamrezmainchannel`).
Empty fields are simply not rendered — nothing is invented.

---

## 4. Run

```bash
npm start
```

You should see the CIPHER BVG banner and the port number. Open
`http://<your-host>:<PORT>`.

For a background service use `pm2 start index.js --name cipher-bvg` or a systemd
unit with `ExecStart=/usr/bin/node /path/to/sunrako/index.js`.

### 4.1 Demo account (browse the panel without registering)

Every panel page is behind the session cookie, so you are bounced to
`login.html` until an account exists. To create a throwaway one:

```bash
npm run demo
```

It prints:

```
  ── Demo login ────────────────────────────
   Username : demo
   Password : demo1234
   UID      : 482193
  ──────────────────────────────────────────
   Role     : Member (no premium, no admin)
```

Open `http://localhost:2024/login.html`, sign in with those details, and every
section (PAIR, CMD, OWNER, PROFILE) becomes browsable.

- Override the credentials with `DEMO_USERNAME` / `DEMO_PASSWORD` / `DEMO_EMAIL` —
  either as real shell variables or in `.env` (this script reads `.env` too).
- Running `npm run demo` again **resets** the password and keeps the same UID.
- Remove it with `npm run demo:remove`.
- The account is a plain **Member**: no premium, no admin, so it cannot reach
  premium-gated or admin commands. It is never created automatically at boot —
  a production deployment only gets it if you run the script yourself.

---

## 5. First-run walkthrough

1. **Splash** — `index.html` animates for ~2 s, then sends you to login or the
   panel depending on your session cookie.
2. **Register** — creates an account and issues a unique random 6-digit UID.
   The UID is shown once in a modal; it is your identity for premium requests.
   It is *not* a password.
3. **Login** — sets a persistent httpOnly `cipher_session` cookie (30 days with
   "remember me"). Passwords are stored as salted + peppered SHA-256, never in
   plain text.
4. **PAIR** — enter your number in international format (`2348012345678`), press
   *Generate code*, then on your phone: WhatsApp → Linked devices → Link with
   phone number → type the code.
5. **CMD** — type `/` to browse the command registry; tap a command to prefill
   its usage. Commands are gated server-side by level.
6. **OWNER** — real owner contacts and live panel stats.
7. **Profile** — change username/email, upload an avatar (JPG/PNG/WebP, ≤2 MB,
   magic-byte validated), change password, copy UID, log out.

---

## 6. Premium activation (Telegram, by UID)

Only the owner/authorised admins can grant premium. In the bot:

```
/premium 482193 lifetime
/premium 482193 monthly 30
/premium-check 482193
/premium-off 482193
```

The bot finds the account by its 6-digit UID, writes the membership into
`Database/user.json`, and appends an entry to `Database/audit.json`
(`premium.activate` / `premium.deactivate`) recording which admin did it.

Premium unlocks the `premium`-level commands. The check runs on the server in
`/api/cmd/execute` — the browser cannot grant itself access.

### 6.1 FREE / PREMIUM command tiers (`/commands`)

Any command can be flipped between **FREE** and **PREMIUM** from Telegram, with
no restart and no file editing:

```
/commands                      tap-to-toggle panel (the only way to switch a tier)
/cmdlist                       print all commands with their tier
/cmdfree                       list the FREE commands only
/cmdpremium                    list the PREMIUM commands only
/cmdset <cmd> <tier>           explicit tier set: free | premium | admin
```

`/commands` renders inline buttons grouped into FREE / PREMIUM / ADMIN sections;
tapping a button flips that command and the keyboard re-renders in place.
`/cmdset <cmd> <tier>` flips one command directly without opening the panel.

Every toggle writes `Database/commands.json` and appends a
`command.level_change` entry to `Database/audit.json`. The web routes read
`commands.json` fresh on every request (no module cache), so `cmd.html` shows the
new badge on the next reload — the Node process does not need to restart.

Access to these commands is restricted to Owner, Moderator and Authorized roles.
Commands whose tier is `admin` are never listed for normal users.

---

## 7. Database backup (Telegram)

The whole database layer is zipped and delivered as a Telegram document — no
external storage, no credentials to configure.

### 7.1 Automatic — every 10 hours

Once the bot launches, a timer is armed and a fresh archive is sent to the
owner chat (`OWNER_ID`) every **10 hours**. The loop is tied to the bot, so if
`BOT_TOKEN` is unset the web panel still runs and backups simply stand down.

The time of the last successful auto backup is persisted in
`backups/.last-auto-backup`. If the server was down past that 10-hour window,
a backup is sent **immediately on boot** instead of waiting another full cycle,
so a crash loop can never silently leave the database unbacked.

The timer is `unref()`-ed and cleared on `SIGINT`/`SIGTERM`, so it never keeps
the process alive or blocks a clean shutdown.

### 7.2 Manual — one tap, file arrives

Two ways to pull an archive immediately:

| How | Result |
|---|---|
| `/backup` in the owner chat | Status panel with **🗄 Backup now** and **📊 Status** buttons |
| Tap **🗄 Backup now** | A `.zip` arrives in the owner's private chat as a document |
| **🗄 Backup database** on `/start` | Same archive, one tap |

The button answers the tap (`Building backup…`) and then sends the file, so the
client never sits on a spinner. The archive is always delivered to the
**owner's private chat** (`OWNER_ID`), never to whichever chat the button was
tapped in.

Backup commands are **owner-only** — the archive contains `Database/.pepper`.

### 7.3 What is inside

```
cipher-backup-YYYY-MM-DD_HHMMSS-{auto|manual}.zip
├── BACKUP-README.txt         manifest: timestamp, trigger, file list
├── config.json
├── package.json
├── sessions.json             active WhatsApp numbers
└── Database/
    ├── config.js  owner.json  commands.json  akses.json
    ├── user.json  audit.json  pairing.json   sessions.json
    └── .pepper               ⚠ password pepper — keep private
```

WhatsApp credential folders under `auth/` are **not** included: they are large,
they are live credentials, and Baileys rebuilds them from the phone.

### 7.4 Retention

The newest **5** archives are kept in `backups/` (git-ignored, excluded from the
Docker image). Older ones are deleted automatically. Telegram keeps its own copy
of every archive that was delivered, so nothing is lost when a local file is
pruned.

### 7.5 Restoring

```bash
# stop the server first
unzip cipher-backup-YYYY-MM-DD_HHMMSS-auto.zip -d /path/to/sunrako
npm start
```

`Database/.pepper` must come back with the archive. Without it every stored
password hash stops verifying and all users must reset.

---

## 8. Deployment

The app is a single Node process with filesystem-backed JSON storage. Any host
that can run `node index.js` and keep a writable directory works.

### 8.1 Railway (recommended)

`railway.json` is included and pins the start command plus a `/api/health`
healthcheck.

1. Push the repo to GitHub, then *New Project → Deploy from GitHub*.
2. Set variables: `BOT_TOKEN`, `OWNER_ID` (and `TRUST_PROXY=1`, since Railway
   proxies traffic).
3. Railway injects `PORT` automatically — do not hardcode it.
4. **Storage:** the container filesystem is ephemeral. Attach a **Volume**
   mounted at `/app/Database` (and `/app/uploads`, `/app/backups`) so accounts,
   the pepper, uploaded avatars and the backup history survive redeploys.
   Without a volume, every restart wipes all users.

Docker builds are also supported: Railway detects the included `Dockerfile`.

### 8.2 Katabump

1. Create a Node.js server, upload/clone the project.
2. Set the startup command to `node index.js` (or `npm start`).
3. Add the same environment variables in the panel's env section.
4. Katabump allocates a port — make sure `PORT` matches what the panel expects,
   or leave it unset so the app falls back to `2024` and map that port.
5. Keep the `Database/`, `uploads/` and `backups/` folders inside the server's
   persistent storage.

### 8.3 Pterodactyl

1. Use an **egg for Node.js** (generic Node egg) or the included Docker image.
2. Set the startup command to `node index.js`.
3. In *Startup Variables* set `PORT` to the allocated server port.
4. Add `BOT_TOKEN`, `OWNER_ID` in *Startup Variables* or the egg's environment.
5. `/home/container` is persistent, so `Database/`, `uploads/` and `backups/`
   survive restarts — no extra volume needed.
6. If the egg runs behind wings' proxy, set `TRUST_PROXY=1`.

### 8.4 Plain VPS (Docker or systemd)

```bash
docker build -t cipher-bvg .
docker run -d --name cipher-bvg \
  -p 2024:2024 \
  -e BOT_TOKEN=... -e OWNER_ID=... \
  -v "$PWD/Database:/app/Database" \
  -v "$PWD/uploads:/app/uploads" \
  -v "$PWD/backups:/app/backups" \
  --restart unless-stopped cipher-bvg
```

Without Docker: `npm install --omit=dev && npm start` under pm2 or systemd.

---

## 9. Files

```
sunrako/
├── index.js              server entry: Express + bot + engine boot
├── config.json           session/rate-limit/upload tuning
├── package.json
├── Procfile              web: node index.js
├── railway.json          Railway start command + healthcheck
├── Dockerfile            node:20-slim production image
├── .dockerignore
├── .env.example          environment variable template
├── .gitignore
├── Assets/               static banners (served at /assets)
├── uploads/              runtime avatar uploads (served at /uploads)
├── backups/              runtime backup archives (newest 5, git-ignored)
├── Database/
│   ├── config.js         env-driven Telegram token, owner id, port
│   ├── seed-demo.js      optional demo account (npm run demo)
│   ├── owner.json        OWNER section content
│   ├── commands.json     command registry (name/desc/usage/level)
│   ├── akses.json        roles: owners, resellers, pts, moderators
│   ├── user.json         accounts (hashed passwords, UIDs)
│   ├── audit.json        audit trail
│   ├── .pepper           auto-generated password pepper (KEEP + BACK UP)
│   ├── sessions.json     session tokens (created at runtime)
│   └── pairing.json      pairing registry (created at runtime)
├── backend/
│   ├── engine.js         safe loader for the WhatsApp layer
│   ├── routes.js         all HTTP API routes
│   ├── database.js       storage, UID generation, audit, premium, commands
│   ├── security.js       hashing, session tokens
│   ├── html.js           escapeHtml for Telegram parse_mode:"HTML"
│   ├── commandAdmin.js   FREE/PREMIUM command tier manager for the bot
│   ├── backup.js         zip builder + 10-hour backup scheduler
│   ├── wa.js             Baileys pairing/session engine
│   ├── bugs.js           command payloads
│   └── telegram.js       bot commands
└── public/
    ├── index.html        splash
    ├── login.html        sign in + CSS robot animation
    ├── register.html     sign up + UID reveal
    ├── pair.html         PAIR section
    ├── cmd.html          CMD terminal + command list
    ├── owner.html        OWNER section
    └── profile.html      account settings
```

Each page is a single self-contained file with its inline CSS and JS.

---

## 10. Security notes

- Passwords: `sha256(sha256(password) : salt : pepper)` — no plaintext anywhere.
  Comparison is constant-time. The pepper is generated on first boot into
  `Database/.pepper`; it is never the value shipped in `config.json`.
- Sessions: random 48-hex tokens in an **httpOnly**, `SameSite=Lax` cookie that
  is also `Secure` when served over HTTPS, stored with an expiry and swept
  hourly, deleted on logout.
- Rate limit: 120 requests / 60 s per IP. Credential endpoints
  (`/api/login`, `/api/register`, `/api/profile/password`) are capped separately
  at 10 attempts / 10 minutes.
- CORS: same-origin only by default. Set `PANEL_ORIGIN` only if the frontend is
  hosted on a different domain.
- `TRUST_PROXY=1` is required behind a reverse proxy (nginx/Caddy/Railway).
  Without a proxy, leave it unset so `X-Forwarded-For` cannot be spoofed to dodge
  the rate limiter.
- Pairing: a user can only request, poll or wait on a number they own; deleting a
  session is restricted to its owner; `/api/pair/list` shows non-admins their own
  device only.
- Avatars: MIME whitelist + magic-byte check + 2 MB cap + generated filenames.
- Owner links served by `/api/owner` are filtered to `http(s)` only, so a
  hand-edited `owner.json` entry cannot inject a `javascript:` href into
  `owner.html`, where it would run in the panel's origin next to the session
  cookie. Only the fields the page renders are forwarded.
- Telegram messages use `parse_mode: "HTML"`; every interpolated value (error
  text, usernames, UIDs, command names, file paths) is escaped first. Telegram
  rejects malformed HTML with 400 and sends nothing, which would otherwise
  silently swallow crash alerts and admin replies.
- The Telegram bot token lives only server-side (env var / `Database/config.js`).
  It is never sent to the browser or exposed through any JSON endpoint.
- All permission checks (premium, admin, paired, command tier) happen on the
  server; admin commands are also hidden from `/api/cmd/list` for non-admins.

---

## 11. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Site loads but PAIR says unavailable | `npm install` incomplete — the WhatsApp engine failed to load. Run install again and restart. |
| No Telegram commands answer | `BOT_TOKEN` is empty. |
| `/commands` does nothing | Your Telegram id is not Owner/Moderator/Authorized in `Database/akses.json`. |
| Premium users still blocked after toggle | The tier was flipped on a different command name. Check `/cmdlist`, then reload `cmd.html`. |
| "Pairing timed out" | Code expired or was mistyped. Request a new one. |
| "WhatsApp rejected the session (401)" | Too many attempts on that number. Wait 15 minutes, then retry. |
| Everyone logged out after restart | `Database/.pepper` or `Database/sessions.json` was deleted, or `security.pepper` was changed. |
| All accounts vanished after redeploy | The `Database/` directory was not on persistent storage. Attach a volume. |
| Port already in use | Change `PORT`. |
| Rate-limit errors on login | 10 attempts / 10 min per IP. Wait, or set `TRUST_PROXY=1` if you are behind a proxy so clients are not all seen as one IP. |