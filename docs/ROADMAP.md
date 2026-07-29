# Market Pulse AI — Roadmap

> A sequenced set of priorities to take Market Pulse from
> "side-project with the right scaffold" to "trustworthy commercial
> product". Priorities are tagged **P0** (must-do before any real
> launch), **P1** (next-90-day quality), **P2** (next-180-day
> expansion), **P3** (nice-to-have / speculative).

---

## P0 — Before any real launch

### P0.1 Lock down secrets & default admin (HIGH)

- Remove the `Admin@123` default in `lib/auth.ts:147` and `.env.example`.
  Require `ADMIN_PASSWORD`; refuse to boot if missing.
- Add a minimum-length check on `JWT_SECRET` (≥ 32 chars).
- Add a `helmet` middleware for security headers (HSTS, X-Frame-Options,
  CSP that allows TradingView's embed domain).
- Encrypt `upstox_settings.{api_key, api_secret, access_token}` at rest.

### P0.2 Replace the "AI" mock with honest copy OR real data (HIGH)

Two viable paths; pick one and own it:

- **Path A — Honest demo**: change the copy on the Commodity AI page
  from "AI Decision Engine" to "Demo Decision Engine" and keep the
  seeded engine as a teaching aid. Remove it from the marketing
  landing copy.
- **Path B — Real**: wire live MCX commodity prices via Upstox
  (commodity segment) and replace the seeded recommendation engine
  with a deterministic rule on real OHLC + volume. Keep the TradingView
  chart (already live) but rebind to the MCX key when connected.

### P0.3 Wire live US data OR change US-market copy (HIGH)

- **Path A — Honest demo**: rename "US markets" section to "US demo" and
  surface a clear banner that the data is simulated.
- **Path B — Real**: wire Alpha Vantage / Polygon / Twelve Data
  behind a feature flag. Add the API key to `.env.example`.

### P0.4 Add the missing healthcheck + graceful shutdown

- Implement `GET /api/healthz` returning `{ status, db, uptime }`.
- Install SIGTERM handler that closes pool + server cleanly.

### P0.5 Decide on a `pages.marketHub` admin role + permissions check

The `requirePermission` middleware exists; backend coverage of
`users.manage` is in place; the **plan-tier** middleware is **not**.
Either ship without plans or add `requirePlan("pro"|"premium")` as a
composable middleware and gate the future-paid routes with it.

## P1 — First 90 days of post-launch

### P1.1 Migrations directory

Replace the single SQL file with `migrations/0001_init.sql` +
`migrations/0002_add_X.sql` + a Node script that runs them in order
and records applied versions in a `_migrations` table.

### P1.2 CSRF protection

Add a per-session CSRF token (double-submit cookie pattern). Verify on
every state-changing route. The auth endpoints need it first since
they're the most damaging target.

### P1.3 Externalise rate-limit state

Move the reset-password rate-limit from the in-process `Map` to Redis
or MySQL. Allow safe horizontal scaling.

### P1.4 Externalise cache

Move the in-process `TTLCache` (quotes, decision, movers) to Redis.
This goes hand-in-hand with horizontal scaling.

### P1.5 OpenAPI parity

Add a CI job that runs the server and walks every path in
`openapi.yaml` to confirm the route exists and returns the documented
status. Currently the spec lists endpoints the server doesn't
implement and vice versa.

### P1.6 Error tracking

Wire Sentry (or any APM) — both server (`pino` → `pino.transport` →
sentry) and frontend (Vite plugin + `@sentry/react`).

### P1.7 Email verification flow

Wire `email_verifications`: on register, enqueue a verify email; gate
specific features on `users.email_verified_at IS NOT NULL`.

### P1.8 Wire a real payments provider

When (and only when) Pro/Premium features ship, integrate Razorpay /
Stripe with a `subscription` table and the corresponding webhook
handlers.

### P1.9 Replace the placeholder admin sections

The AdminPanel has 7 placeholder sections (AI Settings, News, APIs,
Plans, Feedback, Reports, Audit Logs). At least the **Audit Logs**
section is quick to wire — every state-changing route already logs to
`pino`; the UI just needs to render the recent N events with filters.
**Subscription Plans** and **Feedback** are useful and small. The rest
should wait until there is real data.

## P2 — 90–180 days

### P2.1 Real "AI" recommendations

Once at least the data layer is honest (P0.2 / P0.3), layer in a real
recommendation engine. Options:

- a third-party model (OpenAI / Anthropic) with a structured prompt
  over real OHLC
- a self-hosted XGBoost on daily OHLC + volume features
- a backtestable rule-based engine with traceable reasoning

The simplest first step is the third-party model with a feature flag
and a "model name" indicator on every response so users can tell when
it's on.

### P2.2 Forex dashboard

Live currency pair quotes from Yahoo Finance (already supported
upstream); the marketHub forex leaves are all `<ComingSoonPage />`
right now.

### P2.3 Crypto dashboard

CoinGecko public REST API (no key). Add `/api/crypto/quote` and
`/api/crypto/history`.

### P2.4 Screeners

The marketHub leaves for "Screeners" are placeholders. Build a server-
side screener that pulls NSE bulk data and applies a small set of
filters (volume spike, breakout, MACD cross, …). Render results in a
table page.

### P2.5 Strategies / Learn content

Author 5–10 long-form guides covering basics (candles, support /
resistance) and one strategy deep-dive. Markdown → MDX → page. Lives
in `pages/learn/`.

### P2.6 Reports / portfolio analytics

Replace the hardcoded `MOCK_TRADES` in `pages/Performance.tsx` with a
real `trades` table (or derive from `portfolio` + `/api/nse/quote/*`).
Compute real P&L, sector allocation, win rate from actual holdings.

### P2.7 Notifications

Email + browser push for watchlist symbol alerts (price crosses, RSI
oversold). Browser-push needs a service worker + VAPID keys.

### P2.8 Mobile-PWA

Add a service worker, manifest.json, and install banner. The app is
already mobile-responsive (BottomNav + collapsible sidebar).

## P3 — Speculative / long horizon

### P3.1 Multi-user collaboration on portfolios

- share watchlists with role-based permissions
- shared annotations on chart

### P3.2 Backtesting engine

- store historical intraday bars in MySQL (or parquet in Hostinger
  Object Storage)
- run a strategy over them; render equity curve + drawdown

### P3.3 Broker integration (Zerodha Kite, Angel One, etc.)

- OAuth login to a broker
- place orders from the dashboard

### P3.4 Mobile-native apps

Capacitor or React-Native shell, reuse the existing SPA.

### P3.5 Team / org accounts

- invite teammates
- shared portfolios
- admin-as-a-service

---

## Sequencing note

P0.1 and P0.2 block each other only if you decide the AI page should
be paid. If the AI page stays free, P0.2 can be deferred to P1 while
P0.1 ships in days. The DB encryption piece of P0.1 is the
longest-tail item (requires a key-management decision).

P1.1 (migrations) and P1.4 (externalised cache) are foundational for
P1.5/P1.6 — do them in the same sprint.

P2.6 (real Performance page) is the smallest and highest-value P2
item; ship it once P0.2/P0.3 are honest.