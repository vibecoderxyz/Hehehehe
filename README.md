# Supashort — 3D Liquid Glass Control Center

A smart URL shortener with live visitor telemetry, rebuilt from scratch.

Shorten a link, optionally gate it behind a password / social verification, and every visit
streams back hardware, network, GPS and (opt-in) camera intelligence into a live dashboard
rendered in a soft "clay + liquid glass" design system.

> **Clean-room note.** The visual language and the public API shape were reproduced from the
> reference deployment the project owner operates. All implementation code in this repository
> is original. No private credentials, session tokens or protected source were copied.

---

## 0. Two implementations — read this first

This repository contains **two parallel builds of the same product**. They are not intended to
be used together.

| Build | Location | Needs a build step? | Status |
| --- | --- | --- | --- |
| **Standalone single-file** | `standalone/` | **No** — open the `.html` directly | ⭐ **Canonical** |
| Next.js app | `src/` | Yes — `npm install && npm run build` | Reference implementation |

### `standalone/` is the canonical build

Every page is **one self-contained `.html` file** with all CSS in a single `<style>` block and
all JavaScript in a single `<script>` block. There is no build step, no bundler, no framework
runtime, no `node_modules` and no server. Open the file in a browser and the app runs.

```
standalone/
├─ index.html     # Control Center — Shorten, Analytics, Media, Recent + 8 dialogs
├─ gateway.html   # Visitor gateway — password → social → capture → redirect
├─ verify.sh      # integrity checker — no dependencies, run it after any edit
└─ scan.cjs       # older bracket/quote checker (needs Node; optional)
```

### Quick start (canonical build)

1. Copy `standalone/index.html` and `standalone/gateway.html` into **the same folder**.
2. Open `index.html` in any modern browser.
3. Create a link, press **Open**, and the gateway takes over.

Both files must live side by side: `index.html` navigates to the sibling file
`gateway.html?c=<code>`.

### Deploying the website (Vercel or any static host)

The `deploy/` folder is an upload-ready copy of the two pages plus a step-by-step guide
(`deploy/DEPLOY.md`). Nothing is built — Vercel serves the two HTML files as-is:

- **Vercel Drop** — drag the `deploy/` folder (or a `.zip` of it) onto <https://vercel.com/drop>,
  pick a team and name, Deploy.
- **Git** — push `index.html` + `gateway.html` to a repo, import it at <https://vercel.com/new>,
  Framework Preset `Other`, leave build command and output directory empty.

Static hosting covers every client-side feature (link creation, alias, password/social gate,
camera & GPS capture, analytics UI, media studio, coupons, export). It does **not** give the site
a central database — see "What the standalone build stores" below and the privacy note in §"Privacy
model". Anything requiring cross-visitor data needs the `src/` server build plus a real database.

> ⚠️ **`file://` caveat.** Both pages share state through `localStorage`, so they must be treated
> as the same origin. Some browsers give every `file://` document its own opaque origin, which
> would make links created in `index.html` invisible to `gateway.html`. If that happens, serve
> the folder over HTTP instead — any static server works, e.g. `npx serve standalone` or
> `python3 -m http.server` in the folder, or a Vercel deployment. **This has not been verified in
> a real browser** (see §8), so treat the HTTP route as the reliable one.

### What the standalone build stores

One JSON document under the `localStorage` key **`supashort.standalone.v1`**:

```js
{ links: [], visitors: [], coupons: [], user: null, branding: null, sound: true }
```

- `links[]` — `{ id, code, longUrl, createdAt, clicks, password, gateTitle, gateUrl,
  captureCamera, captureLocation, expiresAt, icon, animText, ratio }`
- `visitors[]` — `{ id, code, ts, device, os, browser, screen, language, timezone, platform,
  cores, referrer, ip, city, country, photo, lat, lon, skipped }` (capped at 300 rows, oldest
  trimmed; captured photos are dropped first if the quota is exceeded)
- `user` — `{ id, email, name, plan, planExpiresAt, dailyDate, dailyCount, totalLinks,
  lastCoupon, redeemed[], salt, passHash }`

Everything is local to the browser. Nothing is uploaded anywhere — there is no backend.

### Feature parity and intentional differences

The standalone build has **no server**, so server-only concerns are either reimplemented locally
or deliberately absent:

| Concern | `standalone/` | `src/` (Next.js) |
| --- | --- | --- |
| State | `localStorage` (single document) | JSON file store / swappable DB |
| Accounts | Local record only — password is salted-hashed to stop shoulder-surfing, but **this is not authentication** | `scrypt` password hashing + signed sessions |
| Quotas & coupons | Enforced in-page; reset at local midnight | Enforced server-side, per UTC day |
| Visitor telemetry | Written by `gateway.html` into the same store | `POST /api/track` |
| Geo-IP | Not performed — city/country stay empty | `ip-api.com` lookup |
| Link expiry | **Supported** (Shorten + Manage Link) | Supported (`expiresAt` on create/patch) |
| API Hub | Static documentation snippets | Live endpoint reference |

> **On the standalone "account":** there is no server and `crypto.subtle` is unavailable on
> `file://`, so the password is only salted and digested with FNV-1a. That defeats someone
> reading the value over your shoulder; it does **not** protect against anyone with access to the
> browser's storage, because the entire database — including that digest — lives in
> `localStorage`. Treat it as a profile nickname. Real authentication only exists in `src/`.

### Drift warning

`src/` and `standalone/` are two hand-maintained copies of one design system. **They will drift
if both are edited.** New feature work should target `standalone/`; `src/` is kept for reference
and for anyone who wants a real backend. If you need them to stay in sync, port changes in pairs
and re-run `sh standalone/verify.sh` — it exits non-zero if the two pages, or either
page's script, are internally inconsistent.

### Design-system class names

`standalone/index.html` carries **both** the short working names (`.glass`, `.recessed`, `.stat-*`,
`.dock-btn.on`) and the reference's original names, mapped to identical values:

| Reference name | Use |
| --- | --- |
| `.clay-panel`, `.clay-board`, `.liquid-glass-box` | the main card surface (`.glass` is the alias) |
| `.clay-recessed` | inset sub-cards (`.recessed` is the alias) |
| `.clay-promo-card`, `.clay-sidebar` | promo tile / desktop sidebar |
| `.clay-small-pill`, `.liquid-glass-input`, `.clay-search-pill` | pills and text inputs |
| `.liquid-glass-dock`, `.dock-nav-btn`, `.dock-nav-btn-active` | the bottom dock and its active tab |
| `.clay-stat-{blue,purple,pink,green}` | tinted stat tiles |
| `.liquid-fill-{blue,red,green,amber,indigo}` | progress-bar fills |
| `.glass-orb`, `.orb-{blue,purple,red,green,amber,champagne,clear,rainbow}` | glossy round buttons |
| `.clay-scroll`, `.truncate-mobile` | scrollbar styling / one-line truncation |
| `.create-result`, `.cr-*` | the success card after shortening (green check orb, Copy/Share/Test) |
| `.media-*` | Media Studio surface: 16:9 frames, format pills, sliders, before/after tiles |

Because both names exist, markup pasted from the API docs, the prompt output or an exported
template still renders correctly. `paintChrome()` keeps `.dock-nav-btn-active` in sync with the
`.on` class so the gloss strip follows the selected tab.

### Responsive layout rules

The page has **three** breakpoints, and the navigation deliberately changes at the third:

| Width | Navigation | Notes |
| --- | --- | --- |
| `< 640px` | bottom dock | single column, `118px` bottom padding clears the dock |
| `640–1023px` | bottom dock | single column, `126px` bottom padding |
| `≥ 1024px` | **left sidebar** | the dock is hidden (`lg:hidden`, as in the reference) and the reserved bottom padding drops to `24px` |

> The breakpoints are deliberately `1023` for hiding the sidebar and `1024` for hiding the dock.
> Using `1024` for both left a 1px-wide band where **neither** navigation existed.

Other responsive details worth keeping:
- `.wrap` adds `env(safe-area-inset-bottom)` so the dock never sits under an iPhone home bar.
- `.hdr-actions` collapses the `Direct HTML` pill to its icon below `400px`, and shrinks the
  orbs below `360px` (where `#hdrHint` is also hidden). On phones (`<640px`) the coupon and API
  orbs drop out of the header — both live in the dock and the ☰ menu there — leaving sound,
  identity-sync, the account pill and the hamburger.
- `.field-row` is a `flex-wrap` two-up that falls back to one column under ~320px.
- `.res-actions` is 4-across, becoming 2×2 below `420px`.
- `.m-actions` (camera and converter button rows) is `repeat(auto-fit,minmax(105px,1fr))` so the
  three camera buttons go 3-up → 2-up → 1-up instead of being squeezed by `flex:1`.
- `.link-actions` is `repeat(4,1fr) 40px` (the delete chip is narrow), becoming 2-up below `560px`.
- `.list-scroll` caps the visitor **and** recent feeds at `62dvh`, dropping to
  `calc(100dvh - 310px)` / `calc(100dvh - 280px)` under `1024px` / `480px` so they stop above
  the dock rather than scrolling underneath it (with a `min-height` floor so they never collapse).
- `#panelTitle` drops to `15px!important` below `400px` (its size is an inline style, hence the
  `!important`) — at `17px` the heading wrapped to three lines on a 320px screen.
- `.panel-heading` (page heading + refresh orb) and `.ana-head` (analytics title + live badge) are
  `space-between` flex rows; `.ana-head` stacks below `480px` and its `.ana-title` wraps, so
  `Live Visitor Telemetry` + the `N records` pill never crush the live badge.
- `.nav-pill` uses a `2px` border in **both** the resting and `.on` states, so selecting a pill does
  not shift its neighbours by a pixel.
- The `#apiTabs`, `#apiCodeTabs` and media-studio pill rows use `flex-wrap` so their pills wrap
  instead of shrinking to unreadable widths.
- `.qa-menu` is a `w-60` (15rem) `clay-board` panel anchored right under the ☰ orb; on phones it
  holds exactly the seven reference rows (Shorten / Analytics / Media / Recent / API Hub / Coupon /
  Direct HTML) and closes on outside tap or `Escape`.
- `.toasts` sits at `bottom:84px` on phones to clear the dock, dropping to `24px` at `≥1024px`
  where the dock (and the bottom padding that reserved space for it) is gone.
- `.modal-card` switches to `calc(100dvh - 24px)` and tighter padding below `480px` so a phone
  keyboard cannot push the footer off-screen.
- `#statGrid` uses `repeat(auto-fit,minmax(118px,1fr))` — four tiles on wide screens, two on phones.

---

## 1. Quick start (Next.js build)

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run build        # production build
npm start            # serve the production build
npm run lint         # Next.js lint
```

Requirements: **Node.js 18.18+** (Node 20 LTS recommended) and npm 9+.

No external services, API keys or database are required for the app to boot.

---

## 2. Environment variables

Copy `.env.example` to `.env.local` and edit as needed. Every variable is optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | *(auto-detected)* | Canonical origin used to build short links for bots/API consumers. Falls back to the request's `x-forwarded-proto` + `host`. **Set this in production.** |
| `SUPASHORT_DATA_DIR` | `.data` | Directory holding the JSON data store. Must be writable. |
| `NEXT_PUBLIC_BRAND_NAME` | `Saqib Visuals` | Default brand name for the sidebar / promo card. |
| `NEXT_PUBLIC_DEVELOPER_NAME` | `Muhammad Saqib` | Default developer name baked into exported HTML. |
| `NEXT_PUBLIC_CHANNEL_URL` | `https://youtube.com/@saqibvisuals` | Default channel link for exported HTML. |
| `NEXT_PUBLIC_AVATAR_URL` | *(hosted PNG)* | Default avatar. Any HTTPS image URL works. |

Branding can also be changed at runtime through `POST /api/settings`; the JSON store wins over
the environment defaults once written.

---

## 3. How it works

### Routes

| Route | Kind | Description |
| --- | --- | --- |
| `/` | page | The control center: Shorten, Live Analytics, Media Studio and Recent Links panels, plus the coupon, API hub, export and auth dialogs. |
| `/<code>` | page | Visitor gateway for a short link. Runs the password → social → capture flow, posts telemetry, then redirects to the destination. |
| `/not-found` | page | Friendly 404. |

Every short code is a top-level path, so aliases that collide with real routes are rejected
(`src/lib/validate.ts` keeps a reserved-word list: `api`, `admin`, `dashboard`, `_next`, …).

### API

| Method & path | Auth | Description |
| --- | --- | --- |
| `POST /api/shorten` | optional bearer | Create a link. Body: `longUrl`, `customAlias`, `phoneNumber`, `deviceId`, `captureCamera`, `captureLocation`, `socialGate*`, `password`, `animation*`, `expiresAt`. |
| `GET /api/links` | optional bearer | List links owned by `deviceId`, `phoneNumber` or the signed-in account. |
| `GET /api/links/[code]` | public | Link metadata (password hash never leaves the server). |
| `PATCH /api/links/[code]` | owner | Update password, social gate, capture rules, animation, expiry or alias. Ownership requires the bearer token, `?deviceId=` or `?phoneNumber=`. |
| `DELETE /api/links/[code]` | owner | Delete the link and its visitor logs. Same ownership rules. |
| `POST /api/links/[code]/unlock` | public | Verify a link password. Rate-limited; never leaks the destination on failure. |
| `GET /api/analytics?urlId=&shortCode=` | owner when `shortCode` is sent | Visitor logs, newest first (max 200). |
| `POST /api/track` | public | Ingest a telemetry payload from the visitor gateway. |
| `GET`/`POST /api/settings` | GET public, POST signed-in | Read/write site branding (`displayName`, `brandName`, `avatarUrl`). Writes require a bearer token because branding is deployment-wide. |
| `POST /api/user/auth` | — | `action: "register" \| "login"`. Returns a bearer token. |
| `DELETE /api/user/auth` | bearer | Revoke the current token only. |
| `GET /api/user/profile` | bearer | Current user, plan, remaining daily quota. |
| `POST /api/user/redeem-coupon` | bearer | Redeem a coupon code. |

### Plans and coupons

| Plan | Daily link quota |
| --- | --- |
| `free` | 5 |
| `premium` | 1000 |

Quota is tracked per UTC day (`daily_date` / `daily_count`). Coupons are seeded on first boot:

| Code | Grants |
| --- | --- |
| `VIP-2026` | premium, 3650 days |
| `PRO-30D` | premium, 30 days |
| `PRO-7D` | premium, 7 days |

A coupon is only consumed after it validates, and each account may redeem a given code once.

---

## 4. Architecture

```
src/
├─ app/
│  ├─ page.tsx                 # "/" shell → AppProvider + ControlCenter
│  ├─ layout.tsx               # metadata, fonts, PWA manifest, theme colour
│  ├─ globals.css              # the clay / liquid-glass design system
│  ├─ [code]/page.tsx          # visitor gateway (server component)
│  ├─ not-found.tsx
│  └─ api/…                    # route handlers (see table above)
├─ components/
│  ├─ AppProvider.tsx          # single source of client state
│  ├─ ControlCenter.tsx        # layout orchestrator + overlays
│  ├─ Sidebar / Header / BottomDock
│  ├─ ShortenPanel / AnalyticsPanel / MediaPanel / RecentPanel
│  ├─ VisitorGateway / VisitorCard
│  ├─ ManageLinkModal / DeviceInfoModal / ImageLightbox
│  ├─ ApiHubModal / ExportHtmlModal / UserAuthModal / CouponModal
│  └─ ui/                      # Modal, Toaster, ToggleCard, SocialIcon
└─ lib/
   ├─ db.ts                    # JSON data store (swap point for a real DB)
   ├─ auth.ts                  # HMAC session tokens, plan + quota helpers
   ├─ client.ts                # typed fetch client + localStorage helpers
   ├─ device.ts / geo.ts       # device fingerprint + free geo-IP lookup
   ├─ standalone.ts            # standalone index.html generator (3 tiers)
   ├─ validate.ts / format.ts / audio.ts / types.ts
   └─ …
```

### Data store — documented limitation

The original deployment persists to a **private Supabase project**. Those credentials are not
available (and would not be appropriate to embed), so this build ships a **local JSON data
store** in `src/lib/db.ts`:

- one JSON document per collection under `SUPASHORT_DATA_DIR` (default `.data/`);
- serialised writes with an in-process write chain, tmp-file + rename for atomicity;
- bounded at 5000 visitor logs (oldest trimmed) and 10 sessions per account.

**Consequences you must plan for:**

1. **Single instance only.** Two Node processes (or several serverless lambdas) do not share
   state. Do not scale horizontally with this store.
2. **Serverless filesystems are read-only or ephemeral.** On Vercel/Netlify the store must point
   at a writable volume, or be replaced.
3. **No row-level security.** Ownership is enforced in the route handlers, not the database.

Every read/write goes through the exported functions in `src/lib/db.ts`
(`listLinks`, `getLinkByCode`, `createLink`, `updateLink`, `deleteLink`, `listLogs`, `addLog`,
`getUserById`, `createUser`, `updateUser`, `redeemCoupon`, `getBranding`, `setBranding`).
Re-implement those against Postgres/Supabase/Drizzle and the rest of the app is unchanged.

### Auth

Stateless HMAC-SHA256 session tokens (`src/lib/auth.ts`): `base64url(payload).signature` with an
expiry, signed by a per-process secret. Tokens are also recorded on the user record so a single
session can be revoked on logout. Passwords are hashed with `scrypt` and compared in constant
time.

If `SESSION_SECRET` is not set, a random signing key is generated at boot — **sessions then die
on restart**. Set `SESSION_SECRET` to a long random string in any long-lived deployment:

```bash
SESSION_SECRET="$(openssl rand -hex 32)"
```

### Geo-IP

`src/lib/geo.ts` calls `ip-api.com` with a 2.5 s timeout and falls back to "Unknown" on failure.
No API key is required, and nothing is cached beyond the individual request.

### Privacy model

- Camera and GPS capture are always **opt-in** at the browser level, and the gateway always
  offers a "Skip verification" exit.
- Telemetry is written only to this deployment's own store.
- Captured images are stored as data URLs inside the log record; keep the log cap in mind when
  estimating disk usage.

### URL safety

`localStorage` is editable by anyone with dev tools, so the standalone gateway does **not** trust
the link record it reads. Both the social-gate URL and the redirect destination are re-validated
through `safeHttpUrl()` immediately before use, and the gateway refuses to redirect anywhere that
is not `http:`/`https:`. Without that check, a hand-edited `javascript:` destination would run in
the visitor's origin the moment the auto-redirect fired. The Shorten field applies the same rule
at creation time (`normalizeUrl`), so both ends agree.

All dynamic text in the gateway goes through `.textContent`, never `innerHTML` — verified: that
file contains no `innerHTML` at all.

---

## 5. Deployment

### Vercel / Netlify / any serverless host

The UI is a static-first App Router surface, but the API routes need a persistent writable
location for the JSON store. Two options:

1. **Recommended:** port `src/lib/db.ts` to a managed Postgres (Neon, Supabase, RDS). The file
   is deliberately the only place that touches storage.
2. Mount a writable volume and set `SUPASHORT_DATA_DIR` to its mount path.

Set `NEXT_PUBLIC_SITE_URL` to the public origin so bot integrations receive absolute short URLs.
Set `SESSION_SECRET` so sessions survive restarts.

### Docker / VPS

```bash
npm ci
npm run build
SUPASHORT_DATA_DIR=/var/lib/supashort \
NEXT_PUBLIC_SITE_URL=https://your.domain \
SESSION_SECRET="$(openssl rand -hex 32)" \
npm start
```

Mount `/var/lib/supashort` as a volume and back up that directory — it is the entire database.

---

## 6. Media Studio

Two fully local tools, no uploads:

- **Webcam** — `getUserMedia` preview, front/rear switch, single-frame capture, JPEG download.
- **Converter** — image → JPEG / PNG / WEBP with quality and max-width controls, live before /
  after size comparison, download. Runs on a canvas in the browser.

---

## 7. Standalone HTML export

`src/lib/standalone.ts` generates a single self-hosted `index.html` that talks to
`POST /api/shorten` on this deployment. Three visual tiers are offered (Free Minimal, Pro Dark,
VIP 3D Clay), and the developer name, brand and channel URL are baked in. Download it from the
sidebar ("Direct Download HTML") or the API hub.

---

## 8. Verification status

This project was written in an environment with **no Node.js, npm, JDK or Android tooling**, so
**nothing in this repository has ever been built, bundled, started or exercised in a browser.**
No automated test suite is included. What *was* verified is static analysis only:

- ✅ every file was read back after editing, and passed a syntax/balance check;
- ✅ every `@/…` import in `src/` resolves to an existing module (33/33);
- ✅ API contracts were cross-checked against their call sites (ownership params, response
  shapes, plan/quota fields);
- ✅ `standalone/index.html` — parentheses 1857/1857, braces 418/418, brackets 132/132 balanced;
- ✅ `standalone/gateway.html` — parentheses 433/433, braces 140/140, brackets 91/91 balanced;
- ✅ exactly one `<script>`/`</script>` pair per standalone page, and **no literal `</script`
  sequence anywhere except the real closing tag** — the only sequence that would truncate a script
  block. The export generator therefore builds that one tag from fragments
  (`SCRIPT_OPEN = "<" + "script>"`); the surrounding `</style>`, `</head>`, `</body>` and `</html>`
  it emits are plain string literals, which is harmless because a parser in the script-data state
  looks only for `</script`;
- ✅ all 162 `$("#id")` lookups in `standalone/index.html` resolve to one of its 183 element IDs,
  with no duplicate IDs; all 22 lookups in `standalone/gateway.html` resolve to one of its 30.
  (Two further ids, `u` and `o`, live inside the *generated* export page's HTML strings and are
  correctly not counted as part of this app);
- ✅ all 84 functions in `standalone/index.html` and all 18 in `standalone/gateway.html` are
  defined exactly once and have at least one caller — no dead code and no undefined calls;
- ✅ `diagnostics` (JSON/XML validity + bracket/quote balance) is clean on both HTML files;
- ✅ **`sh standalone/verify.sh` was executed and passes** (this is the one check in this list
  that is a real run rather than a reading):
  - one `<script>` pair per page, no stray closing tag inside any JS string;
  - brackets balanced — `index.html` 1857 `()`, 418 `{}`, 132 `[]`;
    `gateway.html` 433, 140, 91;
  - no duplicate element ids;
  - every `$("#id")` resolves — 162/162 in `index.html` (of 183 ids), 22/22 in `gateway.html`
    (of 30 ids);
  - no function defined twice; all 84 + 18 functions have at least one caller.
- ✅ **copy parity with the reference** — all 203 strings in `archive-old/rea/children.txt` are present
  across the two pages, either verbatim (196) or as the reference's own alternative wording
  (7, e.g. `Select Platform Icon:` for `Choose Icon`).
- ✅ the checker itself was **fault-tested**: injecting an unbalanced `]]]`, a literal
  `</script>` inside a string, a duplicated `id`, a renamed id and an orphan function each made
  it fail with the expected message. Two false positives it originally had (a callback passed
  as `Promise.all(tasks).then(tick)`, and the pre-existing dead `esc()` helper) were found and
  fixed — the callback is now recognised, and the dead function was deleted.

**Not verified:** that the app renders, that the layout is pixel-accurate against the reference,
that `localStorage` is shared between the two `file://` pages, that camera/GPS capture works,
that image conversion produces correct output, or that any redirect resolves.

### Smoke test to run before shipping (standalone build)

1. Serve `standalone/` over HTTP (`python3 -m http.server`) and open `index.html`.
   Do **not** test from `file://` — opaque origins may not share `localStorage`.
2. **Header**: the brand letters + `3D OS` pill sit left; the orb row holds sound (🔊 orb-clear),
   identity sync (📱), the account pill / Sign In, coupon, API hub, `⬇ Direct HTML` and the
   WhatsApp channel. Below 400px the `Direct HTML` pill collapses to `⬇` only.
3. **Dock**: five buttons — `Shorten`, `Media`, `Stats`, `Recent`, `Coupon` (amber). The active
   tab has the blue gloss strip. Switching tabs moves it.
4. **Quick Actions (the ☰ button beside the page title, hidden from 1024px up)**: tap it — it
   turns blue with an `✕` and drops a `clay-board` panel anchored to the right. Exactly seven
   rows, no badges or separators: Shorten Link / Live Analytics / Media Studio / Recent Links,
   then Live API Hub / Redeem Coupon / Direct Download HTML. It must close on an outside tap and
   on `Escape`, and each row must land on the right screen.
4. Create a link → **Copy** → **Test**; the gateway should run and land on the destination.
   While it fingerprints, the card shows a spinner with the custom animation label (default
   `LOADING`) and, at the end, `Verification complete` + `Redirecting you to <host>…` before
   replacing the location after ~1.3s. A `Continue manually` link is offered throughout.
5. Type an alias, press **Clear** — only the alias field empties, destination stays.
6. In the gateway, grant camera and GPS, then return to **Analytics** — the visit should appear
   with GPU, battery %, cores, touch, screen, RAM and network chips.
7. **Manage** that link, set an expiry date of **yesterday** — the gateway must show
    *"This link has expired"*, name the link (`The owner set an expiration date for /<code>`), and
    label the card `Expired Link` instead of redirecting.
8. Rename the alias in **Manage**; analytics must still resolve to the renamed code.
9. Redeem `PRO-7D`; the quota bar must switch to "of 1000" and the coupon chip to `🌟 Active`.
   The modal must show the *"Daily limits reset automatically at 00:00 UTC midnight."* footnote.
10. Tap the **header sound orb** — it must flip between 🔊 (orb-clear) and 🔇
    (orb-champagne, dimmed) with `aria-pressed` tracking the state; the tap also plays a bubble
    blip. Tap the **phone orb** next to it — it must open the **Identify / Sync** register modal.
11. Open **API Hub** while signed out — it must show the gated screen. Create a free account,
    reopen it; switch to **Code Snippets** and confirm the copy button reads `Copy Code Snippet`
    and toasts `Copied Selected Snippet!`.
12. Open **Export HTML**, download a tier, open the generated file, and confirm its Shorten
    button works. The modal must show the `1-CLICK`, `Customize HTML` and `SETUP` labels.
13. In **Media**, load a JPEG/PNG/WEBP and confirm the "before" size matches the real file size.
14. Create an account in the sidebar, sign out, then try signing in with the **wrong password** —
    it must be rejected. (Before this fix any password was accepted.)
15. Every modal's ✕ must show a "Close" tooltip; **Manage** has a working **Cancel**; the
    **Manage** footer (`Delete` + `Save changes` + `Cancel`) and the **Export** footer
    (`Copy HTML Code` + `Download … index.html`) must reflow rather than squeeze their labels.
16. Check the header at **320px** — it is the tightest row in the build. `#hdrHint` is hidden,
    the orbs shrink below 360px, and the `Direct HTML` pill is icon-only below 400px.
    On a phone (<640px) the coupon and API orbs must be gone from the header (they live in the
    dock and ☰ menu) while sound, identity-sync and the hamburger stay.
17. **Resize across 1024px** — the bottom dock must disappear and the left sidebar must appear
    at exactly the same moment. There must be no width where both are hidden.
18. Media Studio at **320px**: the three camera buttons (`Start camera` / `Flip` / `Capture`) must
    wrap to more than one row rather than being crushed into unreadable pills.
19. Analytics at **320px**: the `Live Visitor Telemetry` heading and the `Live Stream Active` badge
    must stack, and the visitor feed must scroll inside its panel rather than under the dock.
20. Select each sidebar / API-Hub pill in turn — the row must not shift by a pixel when the `.on`
    highlight moves (the resting and active borders are both `2px`).
21. Zoom to 200% (or a ~360px viewport) and open **Quick Actions** — all seven rows must keep
    their one-line ellipsis layout in the fixed `w-60` panel.

### Smoke test (Next.js build)

Run `npm install && npm run build` on a machine with Node 20, then repeat steps 2–7 above
against `http://localhost:3000`. Premium is **1000 links/day**, not unlimited.
