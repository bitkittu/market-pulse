# Market Pulse AI — Project Overview

> Internal documentation for the **MarketPulse AI** monorepo at
> `D:\Projects\market-pulse`. This document captures the **current real state**
> of the application based on a direct inspection of the codebase. It is not a
> spec or a marketing description — pages and menu items have been verified
> against the actual code they ship from.

---

## 1. What the product is

Market Pulse AI is a single-tenant SaaS web app that aggregates real-time
Indian (NSE) and international market data, runs server-side heuristics over
that data to produce intraday and options trade suggestions, and presents the
result behind a JWT-cookie–authenticated dashboard.

The marketing positioning is **AI-powered market analysis** for Indian
retail traders; the production reality is that **no AI provider is
integrated** — every "AI recommendation" on the platform today is a
deterministic, seeded heuristic (see §10 and
[`FEATURE_STATUS.md`](./FEATURE_STATUS.md)).

Primary user personas visible in the code:

- **End user (`role = "user"`)** — sees `AppShell` (sidebar + bottom nav +
  dashboard, portfolio, insights, performance, API settings, Market Hub).
- **Admin (`role = "admin"`)** — sees a separate `AdminPanel` with user
  management (real) and 7 placeholder sections.

## 2. Repository layout

```
market-pulse/
├── artifacts/
│   ├── api-server/        # Express 5 + TS backend, esbuild-bundled to dist/index.mjs
│   ├── stock-dashboard/   # React 19 + Vite 7 frontend
│   └── mockup-sandbox/    # (Replit-only) component preview server
├── lib/
│   ├── db/                # mysql2 pool + table helpers + nse_pulse_hostinger.sql
│   ├── api-spec/          # openapi.yaml (the source of truth for codegen)
│   ├── api-zod/           # generated Zod schemas (codegen output)
│   └── api-client-react/  # Orval-generated React-Query hooks + custom-fetch.ts
├── scripts/               # local utilities
├── docs/                  # this documentation
├── ecosystem.config.cjs   # PM2 production config
├── nginx.conf             # reverse-proxy config
├── pnpm-workspace.yaml    # pnpm workspaces + catalog
├── package.json           # root build orchestration
├── .env.example           # all server-side env vars
└── .replit                # Replit workflow definitions (config only)
```

## 3. Top-level architecture

A pnpm monorepo with two buildable artifacts (`api-server`,
`stock-dashboard`) and four shared libraries (`db`, `api-spec`, `api-zod`,
`api-client-react`). The two artifacts are **independently deployable** but
are normally deployed as a single process: the Express app serves both
`/api/*` and the built SPA static assets from one process (see
[`app.ts:42-64`](../../artifacts/api-server/src/app.ts)).

### 3.1 Build pipeline

Root `package.json`:

```
"build": "vite build (stock-dashboard) && node build.mjs (api-server → ESM bundle)"
"build:deploy": "same — explicit deploy alias"
"typecheck:libs": "tsc --build"
"typecheck": "pnpm run typecheck:libs && pnpm -r --filter ./artifacts/** --filter ./scripts --if-present run typecheck"
```

`artifacts/api-server/build.mjs` runs esbuild with:

- `format: "esm"`, `outExtension: { ".js": ".mjs" }` → emits `index.mjs`
- `esbuild-plugin-pino` plugin → keeps pino workers intact
- `banner` → re-exports `createRequire`, `__filename`, `__dirname` so CJS deps
  inside an ESM bundle still work
- A large `external` allow-list (sharp, bcrypt, prisma, firebase-admin,
  playwright, workerd, …) — anything that needs a real Node addon at runtime
  is never inlined into the bundle

### 3.2 Runtime topology (production)

```
Browser  ──HTTP/HTTPS──▶  nginx :80 (or :443)
                          ├─ /api/* ─── proxy_pass ──▶ Express :3001 (PM2)
                          └─ /* ────── try_files /index.html  (SPA fallback)
                                                       ▲
                                                       └── single ESM bundle serves
                                                           both /api and the SPA build
```

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full lifecycle.

## 4. Technology stack (verified)

| Layer            | Choice                                            | Version (catalog / declared)        |
| ---------------- | ------------------------------------------------- | ----------------------------------- |
| Package manager  | **pnpm** workspaces + catalog                     | declared in `pnpm-workspace.yaml`   |
| Frontend runtime | **React**                                         | 19.1.0                              |
| Frontend build   | **Vite**                                          | ^7.3.0                              |
| UI styling       | **Tailwind CSS**                                  | ^4.1.14 (Tailwind 4 + Vite plugin)  |
| Component layer  | **Radix UI** primitives + shadcn/ui ("new-york")  | per `components/ui/*`               |
| Charts           | **Recharts**                                      | used across dashboards              |
| State / cache    | **TanStack React Query**                          | ^5.90.21                            |
| Animation        | **framer-motion**                                 | 12.35.1                             |
| Icons            | **lucide-react**                                  | 0.545.0                             |
| Forms / validation | **Zod**                                         | ^3.25.76                            |
| HTTP client      | Custom `custom-fetch.ts` (Orval mutator, bearer-token capable) | lib/api-client-react |
| Codegen          | **Orval** from `lib/api-spec/openapi.yaml`        | lib/api-client-react                |
| Backend runtime  | **Node.js**                                       | 24+ (Replit module `nodejs-24`)     |
| Backend framework| **Express**                                       | 5.x                                 |
| Backend build    | **esbuild**                                       | 0.27.3 (catalog override)           |
| Logging          | **pino** + `pino-http`                            | externalized via esbuild-plugin     |
| Auth             | **jsonwebtoken** + **bcryptjs**                   | HS256 / cost 10                     |
| Database         | **mysql2** (no ORM)                              | ^3.22.5 (root dependency)           |
| Email            | **nodemailer** (dynamic import, optional)         | not installed by default            |
| HTTP cache layer | in-memory TTL cache per-process                   | `liveMarketData.ts → TTLCache`      |
| Process manager  | **PM2** (production)                              | `ecosystem.config.cjs`              |
| Reverse proxy    | **nginx**                                         | `nginx.conf`                        |
| Encryption       | bcryptjs (passwords), sha256 (reset tokens)       | both server-side                    |

Frontend language is **TypeScript 5.9.2**. Backend is TypeScript compiled to
ESM via esbuild (no `tsc` for the server).

## 5. Frontend surface (stock-dashboard)

Top-level router lives in `artifacts/stock-dashboard/src/App.tsx` and uses a
**single piece of state** (`useState<Tab>("home")`) — there is **no router
library** like wouter/react-router for the in-app pages. Routing is
hand-rolled via tab state and a `MARKETS.map × SECTIONS.map` switch.

### 5.1 Auth views (unauthenticated)

- `LandingPage` — marketing landing with hardcoded `TICKER_DATA`,
  `FEATURES`, `INDICATORS` arrays (no live data).
- `Login` / `Register` / `ForgotPassword` / `ResetPassword` — full forms
  wired to `/api/auth/*`.

### 5.2 User views (role = user)

- `AppShell` wraps every authenticated page; provides sidebar, top header
  (IST clock, market-open badge, user menu), bottom nav.
- **General tabs:** Dashboard (`Home`), Insights (`Insights`),
  Portfolio (`Portfolio`), Performance (`Performance`), API
  (`ApiSettings`), Account (`Settings`).
- **Market Hub:** 5 markets × 7 sections. Only `intraday/dashboard`,
  `options/dashboard`, `commodities/dashboard`, and `commodities/ai` are
  real pages. Everything else falls through to `<ComingSoonPage />`.

### 5.3 Admin views (role = admin)

- `AdminPanel` — separate top-level shell, 10 sections:
  - **Real:** Dashboard (counts from `allUsers()`), User Management,
    System Monitor.
  - **Placeholders:** AI Model Settings, News Sources, Market APIs,
    Subscription Plans, Feedback, Reports, Audit Logs.

### 5.4 Mobile responsive

- Desktop sidebar (`hidden md:flex`) + mobile bottom nav (`md:hidden`).
- Both share the same `MarketHubMenu` so the 5×7 tree stays in sync.
- Most page layouts use Tailwind responsive utilities (`sm:`, `md:`, `lg:`,
  `xl:`) and CSS grid; chart wrappers have explicit pixel heights for
  TradingView's autosize.

## 6. Backend surface (api-server)

Express 5 app, bootstrapped in `src/index.ts` (waits for MySQL ping and
`seedAuthDefaults` before calling `app.listen`). Routes are mounted under
`/api` in `src/app.ts` and the SPA fallback is appended at the end so
non-API GETs resolve to `index.html`.

### 6.1 Route inventory

All routes below are prefixed with `/api`.

| Path prefix        | File                                  | Auth     |
| ------------------ | ------------------------------------- | -------- |
| `/auth/*`          | `routes/auth.ts`                      | mixed    |
| `/admin/*`         | `routes/admin.ts`                     | required + permission |
| `/stocks/*`        | `routes/stocks.ts`                    | mixed    |
| `/watchlist`       | `routes/stocks.ts`                    | required |
| `/ai/*`            | `routes/stocks.ts`                    | public   |
| `/portfolio/*`     | `routes/nse.ts`                       | required |
| `/decision-engine` | `routes/nse.ts`                       | public   |
| `/gift-nifty/*`    | `routes/nse.ts`                       | public   |
| `/nse/*`           | `routes/nse.ts`                       | public   |
| `/settings/upstox/*` | `routes/nse.ts`                     | required |
| `/suggestions/*`   | `routes/nse.ts`                       | public   |
| `/commodities*`    | `routes/nse.ts`                       | public   |
| `/global-index/*`  | `routes/nse.ts`                       | public   |
| `/fo-analyzer`     | `routes/nse.ts`                       | public   |

Auth endpoints are intentionally **not** in the OpenAPI spec — the Orval
client can't call them. The frontend uses a hand-rolled `AuthContext`
with `credentials: "include"` for `/api/auth/*`.

### 6.2 Live data flow

`lib/liveMarketData.ts` implements a **3-tier fallback** for every quote:

1. **NSE India direct** (`https://www.nseindia.com/api/allIndices`) — uses a
   desktop Chrome User-Agent and `Referer: https://www.nseindia.com/`. This
   is real-time (same data shown on the NSE site).
2. **Upstox** (`https://api.upstox.com/v2/market-quote/quotes`) — only when
   a user has saved Upstox credentials with a live `access_token` in the
   `upstox_settings` table.
3. **Yahoo Finance 2** (`yahoo-finance2`) — final fallback; indices and
   commodities only (no NSE stock coverage via this path).

Cache is a per-process TTL map (`STOCK_TTL = 90s`, `INDEX_TTL = 30s`).
Each entry's `dataSource` field tells the UI which tier served the response
(`"nse"` / `"upstox"` / `"yahoo"` / `"simulated"`).

For commodities (`/commodities`), Yahoo futures are used (e.g. `GC=F`,
`CL=F`, `NG=F`). The MCX INR prices that users expect are derived by
multiplying USD prices by the live `USDINR=X` rate.

### 6.3 Decision engine

`lib/decisionEngine.ts` is a **heuristic, NOT an AI model**:

- `calcPivots(high, low, close)` — classic pivot-point math
- `getMarketStatus` → `BULLISH / BEARISH / SIDEWAYS`
- `calcTradeDecision` → BUY / SELL / WAIT + entry, stop-loss, target, R:R
- `calcMarketPressure` → buyer/seller % from price position in day range
- `calcMoneyFlow` → seeded random `volumeSpike` / `oiChange` + a
  status-driven `smartMoneySignal` label (ACCUMULATION / DISTRIBUTION /
  NEUTRAL)
- `getDecisionPanel` → combines live Gift Nifty quote + the above + the
  first 10 successful rows of a 15-stock signal table, cached for **60s**
  in `decisionCache`

### 6.4 F&O analyzer

`lib/foAnalyzer.ts` (POST `/fo-analyzer`) accepts a manual CE / PE / FUT
trade ticket (`symbol, optionType, strikePrice, buyPrice, currentPremium,
lots, expiry, entryTime?, stopLoss?, target?`) and returns a structured
recommendation with confidence, R:R, decision (HOLD/SELL/BOOK_PROFIT/
WAIT/ADD_MORE/AVOID_TRADE) and risk level. Frontend lives in
`pages/FoAnalyzer.tsx`.

### 6.5 Auth

`lib/auth.ts` implements:

- `signSessionToken(uid)` → JWT `{ uid }`, HS256, 30-day expiry
- `setSessionCookie(res, token)` → `mp_session` cookie, `httpOnly`,
  `sameSite=lax`, `secure` in production
- `requireAuth` middleware loads user from DB and rejects `status !==
  "active"`
- `requirePermission(perm)` middleware
- `seedAuthDefaults` — idempotently upserts roles (admin/user),
  permissions, role→permission map, and **creates the first admin** from
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` (default `Admin@123`) with plan=premium

`routes/auth.ts` implements register, login, forgot-password (sha256-hashed
token, 1h TTL, 5-req/15min IP+email rate limit, generic response to avoid
email enumeration), reset-password (one-shot, clears other outstanding),
profile PATCH, change-password, logout, /me.

## 7. Database

12 tables in `lib/db/nse_pulse_hostinger.sql` (no `CREATE DATABASE` /
`USE`, designed to be imported via phpMyAdmin into a Hostinger MySQL DB
the panel already created):

- **Auth & RBAC:** `roles`, `permissions`, `role_permissions`, `users`,
  `user_profiles`, `login_history`, `password_resets`, `remember_tokens`,
  `email_verifications`
- **App:** `watchlist` (UNIQUE(user_id, symbol)), `portfolio` (UNIQUE
  (user_id, symbol), `buy_price DECIMAL(14,4)`), `upstox_settings`
  (UNIQUE(user_id), stores `api_key`, `api_secret`, `client_id`,
  `access_token`, `live_data_enabled`)

The data-access layer (`lib/db/src/index.ts`) exports a typed `db` object
with one helper per table (CRUD + domain methods). The DB layer **explicitly
rejects** `mongodb+srv://` URIs to guard against a leftover Atlas connection
string; only `mysql://` URLs are accepted.

## 8. Frontend → backend API plumbing

`lib/api-spec/openapi.yaml` declares 30 operations across ~21 paths. It
**deliberately omits all `/auth/*` endpoints** — only authenticated state
APIs (watchlist, portfolio, upstox_settings, insights, F&O) are in the
spec, so Orval can't generate login/registration clients.

The generated `lib/api-client-react/src/custom-fetch.ts` is the standard
Orval mutator: bearer-token capable (via module-level `setAuthTokenGetter`),
auto-parses JSON / text / blob, throws typed `ApiError<T>` and
`ResponseParseError`. **It does not currently use a bearer token getter** —
the app uses httpOnly cookies instead, so the `AuthContext` calls
`fetch('/api/auth/...', { credentials: 'include' })` directly.

## 9. Build & deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md). High-level:

- **Dev:** `pnpm install`, then `pnpm run dev` in each artifact, or use the
  Replit workflows defined in `.replit` (port 22996 for dashboard,
  8080 for API, 8081 for mockup sandbox).
- **Prod:** push to GitHub → Hostinger auto-runs `pnpm install --frozen-lockfile
  && pnpm run build:deploy` → Express serves both API and SPA from a single
  process; nginx fronts it on `:80`.
- **Process:** PM2 (`market-pulse-api`) in fork mode, 1 instance.

## 10. The "AI" claim — what is and isn't actually an AI

> This is the most important framing in this whole document.

What the code calls "AI" today is, in every case, a deterministic
rule-based function:

| Surface                                       | Implementation                                                  |
| --------------------------------------------- | --------------------------------------------------------------- |
| Dashboard decision panel (`/decision-engine`) | Pivot-point math + seeded-random money flow + heuristic RSI     |
| F&O Analyzer (`/fo-analyzer`)                 | Server-side `analyzeFoTrade()` over user-supplied inputs         |
| Stock AI analysis (`/stocks/ai/analysis/:symbol`) | Synthesized (no real upstream)                               |
| Stock market summary (`/stocks/ai/market-summary`) | Synthesized from `STOCKS` map + daily seed                  |
| **Commodity AI Decision Engine**              | **100% mocked client-side** (see §11)                          |
| Insights (`/insights/search`)                 | Server-side heuristic over cached NSE data + canned news        |

There are **zero** integrations with OpenAI, Anthropic, Google Gemini, or
any LLM provider. No `openai`, `anthropic`, `@google/generative-ai`, or
`gemini` import exists in the codebase.

## 11. Commodity AI Decision Engine — illustrative placeholder

`pages/CommodityAIDecisionEngine.tsx` is the most visible piece of the
"AI" branding and is **entirely mocked** on the client. The component
itself ships with the disclaimer:

> "AI recommendations and market data on this page are illustrative
> placeholders for demonstrating the interface — not live trading signals.
> Live data integration is planned for a future release."

Concrete signals that this is a mock:

- `BASE_PRICES` are hardcoded constants (`gold: 71500`, `silver: 84200`,
  `crudeoil: 6450`, `naturalgas: 205`) — INR, not live MCX.
- `RATIONALE` and `NEWS_TEMPLATES` are static arrays per commodity.
- `generateRecommendation`, `generateSentiment`, `generateNews` all run
  through a seeded `mulberry32` PRNG keyed on `${commodityId}-${timeframe}`
  so the values are stable across re-renders.
- `useAIRecommendation`, `useSentiment`, `useCommodityNews` are
  `useMockQuery` — they simulate network latency (350-400 ms) before
  returning the seeded data.
- The TradingView chart is the only piece of **real** data — and even it
  displays the **international spot/futures equivalent** (`TVC:GOLD`,
  `TVC:SILVER`, `TVC:USOIL`, `OANDA:NATGASUSD`) instead of MCX because
  TradingView's free public widget does not carry licensed MCX data
  (commented inline at `data.ts:9-14`).

## 12. Replit dependencies (config-only)

The codebase declares several `@replit/vite-plugin-*` packages in
`pnpm-workspace.yaml`'s catalog:

- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`
- `@replit/vite-plugin-runtime-error-modal`

And `stripe-replit-sync` in `minimumReleaseAgeExclude`.

**None of these are actively imported or wired in production code.**
A grep across `artifacts/` shows the only Replit-related file is
`.replit` itself (workflow definitions for dev). The vite plugins would
only activate if the project were deployed to Replit (gated on
`process.env.REPL_ID`).

## 13. MongoDB references (intentional rejection)

A grep for `mongodb|mongoose|atlas|MONGO_URL|MONGODB_URI` returns exactly
one file: `lib/db/src/index.ts`. The mention is a deliberate code comment
that rejects `mongodb+srv://` URIs to prevent a stale Atlas connection
from being reused now that the project has migrated to MySQL. There are
**no MongoDB driver imports, no Atlas calls, no Mongoose schemas**.

## 14. External data sources used in production

| Source                    | Used for                                            | Auth        |
| ------------------------- | --------------------------------------------------- | ----------- |
| **NSE India** direct      | Nifty 50 / sector / India VIX / Gift Nifty / intraday chart | none (browser UA required) |
| **Yahoo Finance 2**       | US stocks (default), commodities, global indices, USD/INR | none        |
| **Upstox** v2             | Per-user NSE stock + index quotes (when `access_token` saved) | per-user OAuth token |
| **TradingView** embed     | Commodity AI Decision chart + symbol-view chart    | none (public embed) |

No AI provider is wired (see §10). No news source is wired (canned
templates only). No SMS / push provider is wired.

## 15. Hard-coded credentials to be aware of

The following are baked into code or `.env.example` defaults — they are
**not** secrets to leak (they are the documented bootstrap values), but
they **must** be rotated before a real production deploy:

- `ADMIN_EMAIL` default `team@trading.brandmars.com`
- `ADMIN_PASSWORD` default `Admin@123` (in `.env.example` and as the
  fallback in `seedAuthDefaults` when `ADMIN_PASSWORD` is unset)
- `JWT_SECRET` placeholder `change-this-to-a-long-random-string`

The first admin account is auto-created with **plan = `premium`** on first
boot — so the very first person to reach the server gets full access
including any future paid-only features.

## 16. Documentation map

- [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) — this file
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data-flow + component diagrams
- [`FEATURE_STATUS.md`](./FEATURE_STATUS.md) — every feature with
  COMPLETE / PARTIAL / PLACEHOLDER / MOCK / BROKEN tag and the Project
  Status Matrix
- [`DATABASE.md`](./DATABASE.md) — schema, queries, indexes, migration story
- [`API_INTEGRATIONS.md`](./API_INTEGRATIONS.md) — every endpoint, internal
  and external
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — dev / build / production / secrets
- [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md) — current technical debt and bugs
- [`ROADMAP.md`](./ROADMAP.md) — P0 / P1 / P2 / P3 priorities