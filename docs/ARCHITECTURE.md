# Market Pulse AI — Architecture

> Internal documentation of the system architecture as it actually exists
> in the codebase today.

---

## 1. High-level topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser (SPA)                              │
│   React 19 + Vite + TanStack Query + Tailwind 4                          │
│   - AuthContext (cookie-based)                                           │
│   - AppShell: sidebar + bottom nav, tab-based routing                    │
│   - AdminPanel: separate admin shell                                     │
│   - Lazy-loaded page chunks per route                                    │
└─────────────────────────────────────────────────────────────────────────┘
                │  HTTPS, httpOnly mp_session cookie
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  nginx (:80 / :443)  ── nginx.conf                      │
│   /api/*  ──proxy_pass──▶  127.0.0.1:3001                                │
│   /*      ──try_files $uri $uri/ /index.html   (SPA fallback)           │
│   gzip on, 1y immutable cache for hashed assets                         │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│   PM2  ─▶  artifacts/api-server/dist/index.mjs   (single Node process)  │
│   Express 5 + TS + esbuild-bundled, ESM, pino logging                   │
│                                                                         │
│   Middleware order: trust-proxy → pino-http → cors →                    │
│                    cookie-parser → json → urlencoded → /api router →    │
│                    (optional) SPA static + fallback                     │
│                                                                         │
│   ┌─────────────────┐ ┌─────────────────┐ ┌───────────────────────┐    │
│   │ routes/auth.ts  │ │ routes/nse.ts   │ │ routes/stocks.ts      │    │
│   │ + admin.ts      │ │                 │ │ + watchlist CRUD      │    │
│   └─────────────────┘ └─────────────────┘ └───────────────────────┘    │
│           │                  │                       │                  │
│           ▼                  ▼                       ▼                  │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │  lib/auth.ts          ── JWT cookie, bcryptjs, permissions   │     │
│   │  lib/decisionEngine.ts── pivot points, money flow (heuristic)│     │
│   │  lib/liveMarketData.ts── NSE → Upstox → Yahoo (3-tier)      │     │
│   │  lib/upstoxClient.ts ── instrument-key builder, token cache │     │
│   │  lib/foAnalyzer.ts   ── trade-ticket heuristic               │     │
│   │  lib/email.ts        ── optional nodemailer (dynamic import) │     │
│   │  lib/db (workspace)  ── mysql2 pool + typed query helpers   │     │
│   └──────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
                │   mysql2 pool  (promise API, raw SQL, ? placeholders)
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Hostinger MySQL  (shared)                         │
│   Database: nse_pulse_hostinger.sql (12 tables, no CREATE DATABASE)     │
│   Provisioned via hPanel phpMyAdmin import                               │
└─────────────────────────────────────────────────────────────────────────┘

  External (server-side fetch):
   • NSE India public endpoints (https://www.nseindia.com/api/...)
   • Yahoo Finance 2  (yahoo-finance2 npm)
   • Upstox v2 (https://api.upstox.com/v2, Bearer access_token from upstox_settings)
   • TradingView public embed widget (browser-side only)

  External (browser-side embed):
   • TradingView widget (Commodity AI Decision chart, SymbolView chart)
```

## 2. Component diagram (frontend)

```
App.tsx
├── QueryClientProvider
│   └── AuthProvider
│       └── AppRouter
│           ├── [if reset token in URL]  ResetPassword
│           ├── [if user.role === 'admin']  AdminPanel
│           ├── [if user is authenticated]  AppShell
│           │   ├── AppSidebar
│           │   │   ├── General items  (Dashboard, Insights, Portfolio, Performance, API)
│           │   │   └── MarketHubMenu
│           │   │        └── MARKETS × SECTIONS tree (collapsible, 5×7)
│           │   ├── Top bar (ISTClock, UserMenu)
│           │   ├── Main (lazy pages):
│           │   │   ├── Home           (decision panel, alerts, gift nifty,
│           │   │   │                    movers, sectors, global markets)
│           │   │   ├── Insights       (search news + FoAnalyzer embed)
│           │   │   ├── Portfolio      (CRUD + live P&L via indicators)
│           │   │   ├── Performance    (mocked historical trade stats)
│           │   │   ├── Settings       (profile, password, plan)
│           │   │   ├── ApiSettings    (Upstox keys CRUD)
│           │   │   ├── IntradayDashboard
│           │   │   ├── OptionsDashboard
│           │   │   ├── Commodities    (live yahoo commodities)
│           │   │   └── ComingSoonPage (everything else)
│           │   └── BottomNav (mobile: Home / Market Hub / Portfolio / More)
│           └── [unauthenticated]  LandingPage | Login | Register | ForgotPassword
│
├── AdminPanel
│   ├── Sidebar (collapsible)
│   └── Views:
│       ├── DashboardView   (real: counts from allUsers())
│       ├── UsersView       (real: search, plan change, delete)
│       ├── SystemView      (mocked metrics)
│       └── PlaceholderView × 7 (AI Settings, News, APIs, Plans,
│                                  Feedback, Reports, Audit)
```

## 3. Data flow: an authenticated page load

```
1. Browser navigates to / (or any deep link via SPA fallback)
2. App.tsx → AuthProvider on mount:
     fetch /api/auth/me  with credentials: 'include'
       → Express reads mp_session cookie → jwt.verify → loadAuthedUser(uid)
       → SELECT * FROM users ... JOIN roles/role_permissions/permissions
       → 200 { user: { id, name, email, role, plan, joinedAt, lastLogin } }
         or 401 → render LandingPage
3. AppRouter switches on user.role:
     admin → AdminPanel (calls /api/admin/users once)
     user  → AppShell → initial tab "home"
4. AppShell renders Home → 7 React Query hooks fire in parallel:
     /api/decision-engine           (60s cache, server-side)
     /api/gift-nifty/quote         (30s cache, NSE→Upstox→Yahoo)
     /api/gift-nifty/history       (seeded synthesis)
     /api/nse/movers               (Upstox batch → Yahoo chunks)
     /api/nse/sectors              (NSE indices → Upstox batch → Yahoo)
     /api/global-index/quote × 4   (Yahoo only)
     /api/settings/upstox          (DB read; shows whether token present)
5. User interacts (e.g. "Add to Watchlist"):
     useAddToWatchlist → POST /api/watchlist { symbol }
       → requireAuth → db.watchlist.insert(userId, symbol)
       → 201 WatchlistRow
       → queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] })
       → Watchlist re-renders with the new row
6. Switch tab → useState<Tab> changes → lazy chunk for next page loads
   (e.g. Portfolio) → its hooks fire
```

## 4. Live-market data flow (NSE quotes)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  getLiveQuote(symbol)  in liveMarketData.ts              │
└──────────────────────────────────────────────────────────────────────────┘
        │
        │  TTL cache lookup (90s)
        ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ Tier 1 — Upstox  (only if db.upstoxSettings.findLatest() returns  │
   │                    an active access_token)                        │
   │   GET https://api.upstox.com/v2/market-quote/quotes?              │
   │       instrument_key=NSE_EQ|RELIANCE                              │
   │   Headers: Authorization: Bearer <token>                          │
   │            Api-Version: 2.0                                       │
   │   Returns:  last_price, ohlc, volume, net_change                  │
   │   On hit → cache 90s → return buildQuoteFromUpstox()              │
   │          (dataSource: 'upstox')                                    │
   └──────────────────────────────────────────────────────────────────┘
        │  (no token, or Upstox returned null / threw)
        ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ Tier 2 — Yahoo Finance 2                                          │
   │   yf.quote("RELIANCE.NS")                                         │
   │   Returns:  regularMarketPrice, ohlc, marketCap, pe, …           │
   │   On hit → cache 90s → return buildQuoteFromYF()                 │
   │          (dataSource: 'yahoo')                                    │
   └──────────────────────────────────────────────────────────────────┘
        │  (network error)
        ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ Tier 3 — Simulated fallback (NSE_STOCKS seed + small jitter)     │
   │   getNseQuote(symbol) from nseData.ts                             │
   │   dataSource: 'simulated'                                         │
   └──────────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────────┐
   │ Tier 0 — NSE India direct (only used for indices & intraday)      │
   │   GET https://www.nseindia.com/api/allIndices                    │
   │   Headers:  Chrome UA, Referer: https://www.nseindia.com/        │
   │   Cache 30s in nseIndexMap                                        │
   │   Used by: getLiveGiftNifty, getLiveIndiaVix, getLiveSectors      │
   └──────────────────────────────────────────────────────────────────┘
```

## 5. Build & deploy pipeline

```
   Developer
      │
      │ git push origin main
      ▼
   GitHub
      │
      │  (Hostinger connected to this repo)
      ▼
   Hostinger auto-build
      │
      │  pnpm install --frozen-lockfile
      │  pnpm run build:deploy
      │    ├── vite build (artifacts/stock-dashboard)
      │    │   └── outputs to artifacts/stock-dashboard/dist/public/
      │    └── node artifacts/api-server/build.mjs (esbuild)
      │        └── outputs artifacts/api-server/dist/index.mjs
      │
      │  starts: pm2 start ecosystem.config.cjs
      │           → node ./artifacts/api-server/dist/index.mjs
      │             ── connects to MySQL ── seeds admin ── listens :3001
      ▼
   nginx (system service, configured by host panel)
      │
      │  Browser request → /api/foo → proxy :3001
      │                   /any/other → /index.html
      ▼
   Browser
```

## 6. Module boundaries

| Package                          | Purpose                                         | Imports from    |
| -------------------------------- | ----------------------------------------------- | --------------- |
| `lib/db`                         | mysql2 pool + typed table helpers + sql file    | `mysql2/promise` |
| `lib/api-spec`                   | OpenAPI 3.1 source of truth (hand-authored)     | none            |
| `lib/api-zod`                    | generated Zod schemas from spec (codegen)       | `zod`           |
| `lib/api-client-react`           | generated React-Query hooks + custom-fetch       | `lib/api-zod`   |
| `artifacts/api-server`           | backend, bundles with esbuild                   | `lib/db`        |
| `artifacts/stock-dashboard`      | frontend, bundles with Vite                     | `lib/api-client-react`, `lib/api-zod` |

The dependency arrow is strictly one-way:

```
stock-dashboard ──▶ api-client-react ──▶ api-zod ──▶ api-spec
                                                       │
                              api-server ──▶ lib/db ◀──┘ (no dep on api-spec)
```

`api-server` does **not** depend on `api-spec` — the spec is for client-side
codegen only. This is intentional: it avoids a circular dependency and lets
the backend ship without Orval in its bundle.

## 7. Auth data flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Register                                                               │
│   POST /api/auth/register { name, email, password }                     │
│   Server validates name ≥ 2, EMAIL_RE, password ≥ 8                     │
│   bcryptjs.hash(password, 10) → passwordHash                            │
│   INSERT users (role_id of "user", plan = "free")                       │
│   jwt.sign({ uid }, JWT_SECRET) → 30-day token                          │
│   Set-Cookie: mp_session=<jwt>; HttpOnly; SameSite=Lax; Secure(prod)    │
│   201 { user: { id, name, email, role: "user", plan: "free", ... } }    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Login                                                                  │
│   POST /api/auth/login { email, password }                              │
│   SELECT * FROM users WHERE email = ?                                   │
│   bcryptjs.compare(password, hash)                                      │
│   INSERT login_history (user_id, ip, ua, status=success|failure)       │
│   UPDATE users SET last_login_at = NOW()                                │
│   jwt.sign → cookie                                                     │
│   200 { user } | 401 { error } | 403 { error: "suspended" }              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Subsequent request                                                     │
│   GET /api/portfolio                                                    │
│   Cookie: mp_session=<jwt>                                              │
│   requireAuth:                                                         │
│     jwt.verify(token, JWT_SECRET) → uid                                 │
│     SELECT * FROM users WHERE id = ?                                    │
│     SELECT r.*, GROUP_CONCAT(p.name) FROM roles r …                     │
│     requireAuth attaches req.user = { ...user, roleName, permissions }  │
│   handler: db.portfolio.findByUser(req.user.id) → rows → JSON           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Forgot / Reset                                                         │
│   POST /api/auth/forgot-password { email }                              │
│     rate limit 5/15min/IP+email                                         │
│     SELECT * FROM users WHERE email = ?                                 │
│     crypto.randomBytes(32).toString("hex")  → rawToken                  │
│     INSERT password_resets (user_id, token_hash=SHA256(rawToken),       │
│                              expires_at = now + 1h)                     │
│     SMTP if configured → email with ?reset_token=<rawToken>              │
│     else → return devResetUrl in response (gated on SHOW_RESET_LINK     │
│           in production; always off unless NODE_ENV != production)      │
│                                                                          │
│   POST /api/auth/reset-password { token, password }                     │
│     token.length ≥ 20                                                   │
│     SELECT * FROM password_resets                                      │
│       WHERE token_hash = SHA256(token) AND used_at IS NULL              │
│     record.expires_at > now?                                            │
│     UPDATE users SET password_hash = bcrypt(newPassword) WHERE id = ?   │
│     UPDATE password_resets SET used_at = NOW()                          │
│     DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL   │
│     200 { message }                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## 8. Concurrency & cache model

- The Express process is a **single Node instance** (`PM2 fork, instances=1`).
  No cluster mode, no horizontal scaling inside one server. Horizontal scale
  is possible but would need externalising the in-process TTLCache in
  `liveMarketData.ts`.
- The rate-limit map for password resets is also per-process
  (`resetAttempts: Map<string, …>`). Multi-instance deploys would let
  attackers get up to N× the documented limit.
- The `decisionCache` for `/decision-engine` is per-process and 60-second
  TTL; a multi-instance deploy would let two simultaneous requests for the
  same panel double the upstream NSE/Upstox call rate for the first minute.

## 9. Failure & timeout behaviour

- `/api/fo-analyzer` returns 400 on missing/invalid required fields.
- `/api/gift-nifty/quote`, `/api/nse/movers`, `/api/nse/sectors`,
  `/api/nse/quote/:symbol` all swallow upstream errors and return 500
  with `{ error: "Failed to fetch ..." }`. Each handler tries the 3
  tiers internally; if all 3 fail, only then does it surface a 500.
- `/api/portfolio` and `/api/settings/upstox` log via `req.log.error` and
  return 500 on DB failure.
- `/api/auth/*` returns generic 400s with messages (e.g.
  `"Email and password are required"`) and **does not** log sensitive
  fields — only the error message gets logged.

## 10. Security perimeter

- Cookies are `httpOnly`, `sameSite=lax`, `secure` in production.
- CORS is wide-open (`app.use(cors())`) — there is no origin allow-list.
  This is acceptable only because the server is intended to be served
  behind nginx and the app does not call cross-origin API hosts.
- `app.set("trust proxy", 1)` is set so `req.ip` reflects the real client
  IP behind nginx.
- All DB queries use `?` placeholders (mysql2/promise `execute`/`query`).
  No string concatenation in any helper in `lib/db/src/index.ts`.
- `JWT_SECRET` is **required** (`getJwtSecret()` throws if unset); the
  process will refuse to boot without it.
- bcrypt cost = 10. SHA-256 for password-reset tokens (raw token never
  stored).
- Admin deletion is blocked server-side
  (`if (role?.name === "admin") return 403`).
- The `/api/admin/*` router mounts `requireAuth` once at the top so
  every admin route is authenticated.

## 11. Build artefacts (post-`pnpm run build:deploy`)

```
artifacts/api-server/dist/
├── index.mjs                  # ESM bundle (express, mysql2, pino, etc.)
├── index.mjs.map              # linked sourcemap
└── (no node_modules copied — externals resolve from root)

artifacts/stock-dashboard/dist/public/
├── index.html                 # vite-built SPA shell
├── assets/
│   ├── index-<hash>.js        # main bundle
│   ├── index-<hash>.css
│   ├── chunks/
│   │   ├── Home-<hash>.js     # lazy chunks per page
│   │   ├── Portfolio-<hash>.js
│   │   └── … (one per lazy import)
│   └── …
└── favicon, logo, etc.
```

The Express app picks up `dist/public/` via
`path.resolve(bundleDir, "../../stock-dashboard/dist/public")` and falls
back to `FRONTEND_DIST` env var if the relative path doesn't resolve.

## 12. What lives outside the monorepo

- **Env vars** for production: managed by Hostinger hPanel, NOT in a
  checked-in `.env`. `.env.example` is the documented contract.
- **Schema migration**: the only schema file is
  `lib/db/nse_pulse_hostinger.sql`. It must be imported manually into
  the Hostinger MySQL via phpMyAdmin.
- **AI provider keys**: there are no AI providers in the system, so there
  are no keys to provision.
- **Replit configuration**: `.replit` lives in the repo; the project's
  primary deploy target is Hostinger, but the workflows still let it boot
  on Replit for development.