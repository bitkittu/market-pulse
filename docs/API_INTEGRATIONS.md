# Market Pulse AI — API & Integrations

> Every internal route + every external API the codebase depends on, as
> they actually exist in code. Where an endpoint exists in
> `openapi.yaml` but the router does not implement it (or vice versa),
> that gap is called out.

---

## 1. Internal REST API (Express, `artifacts/api-server/src/routes/*`)

All routes are mounted at `/api`. JSON in / JSON out unless noted.
Authentication state is the `mp_session` httpOnly cookie; the React
client never sets a `Bearer` header itself.

Legend:

- **INT** = internal (our server)
- **EXT** = external upstream call
- **AUTH** = `requireAuth` middleware
- **PERM** = `requirePermission(name)` middleware

### 1.1 Auth (`routes/auth.ts`)

| Method | Path                          | Auth  | Permission | Purpose                                         |
| ------ | ----------------------------- | ----- | ---------- | ----------------------------------------------- |
| POST   | `/api/auth/register`          | —     | —          | Create user, role=`user`, plan=`free`           |
| POST   | `/api/auth/login`             | —     | —          | Verify creds, log login_history, set cookie     |
| POST   | `/api/auth/forgot-password`   | —     | —          | Create SHA-256-hashed reset token (1h TTL)      |
| POST   | `/api/auth/reset-password`    | —     | —          | Consume token, set new password                 |
| POST   | `/api/auth/change-password`   | AUTH  | —          | Require current + new password                  |
| PATCH  | `/api/auth/profile`           | AUTH  | —          | Update name (length 2-120)                      |
| POST   | `/api/auth/logout`            | —     | —          | Clear cookie (no-op if cookie missing)          |
| GET    | `/api/auth/me`                | —     | —          | Returns current user or 401                    |

**Rate limit** for `/forgot-password`: 5 requests per 15 minutes per
`(IP, email)` tuple, enforced by an in-process `Map`.

### 1.2 Admin (`routes/admin.ts`)

| Method | Path                                 | Auth  | Permission     | Purpose                              |
| ------ | ------------------------------------ | ----- | -------------- | ------------------------------------ |
| GET    | `/api/admin/users`                   | AUTH  | `users.view`   | List users with roles                |
| DELETE | `/api/admin/users/:id`               | AUTH  | `users.manage` | Delete user (blocks admin role)      |
| POST   | `/api/admin/users/:id/plan`          | AUTH  | `users.manage` | Set plan to `free` / `pro` / `premium` |

### 1.3 NSE live data (`routes/nse.ts`)

| Method | Path                              | Auth | Live?             | Notes                                            |
| ------ | --------------------------------- | ---- | ----------------- | ------------------------------------------------ |
| GET    | `/api/gift-nifty/quote`           | —    | YES (NSE direct)  | 30s cache; Tier-1 NSE → Upstox → Yahoo           |
| GET    | `/api/gift-nifty/history`         | —    | synthesized       | seeded walk from current price                    |
| GET    | `/api/gift-nifty/intraday`        | —    | YES (NSE direct)  | NSE chart-databyindex, no fallback               |
| GET    | `/api/decision-engine`            | —    | YES (NSE live for nifty) | 60s cache; pivot math + seeded money flow |
| GET    | `/api/nse/movers`                | —    | YES               | Upstox batch → Yahoo chunks                       |
| GET    | `/api/nse/sectors`               | —    | YES               | NSE → Upstox → Yahoo                              |
| GET    | `/api/nse/india-vix`             | —    | YES (NSE + hardcoded fallback 14.82) |                  |
| GET    | `/api/nse/quote/:symbol`         | —    | YES               | Upstox → Yahoo → simulated                        |
| GET    | `/api/nse/history/:symbol`       | —    | synthesized       | seeded walk                                       |
| GET    | `/api/portfolio`                 | AUTH | DB                | returns rows + indicator chips                    |
| POST   | `/api/portfolio`                 | AUTH | DB                | upsert symbol (BUY price optional)                |
| DELETE | `/api/portfolio/:id`             | AUTH | DB                | remove                                            |
| GET    | `/api/settings/upstox`           | AUTH | DB                | one row per user                                  |
| POST   | `/api/settings/upstox`           | AUTH | DB                | replaces row (api_key, secret, client_id, token)  |
| POST   | `/api/settings/upstox/test`      | AUTH | EXT (Upstox)      | calls Upstox with saved token to validate         |
| DELETE | `/api/settings/upstox`           | AUTH | DB                | clear the user's token                            |
| GET    | `/api/suggestions/intraday`      | —    | synthesized       | top 15 suggestions over `NSE_STOCKS` map         |
| GET    | `/api/suggestions/options`       | —    | synthesized       | options strategies on `NSE_STOCKS`               |
| GET    | `/api/commodities`               | —    | YES (Yahoo)       | 10 symbols + INR conversion                       |
| GET    | `/api/commodities/history`       | —    | YES (Yahoo)       | allow-listed symbols                              |
| GET    | `/api/global-index/quote`        | —    | YES (Yahoo)       | allow-list: ^NYA, 000001.SS, ^HSI, ^NSEI          |
| GET    | `/api/global-index/history`      | —    | YES (Yahoo)       | same allow-list                                   |
| POST   | `/api/fo-analyzer`               | —    | server heuristic  | validates body shape, returns trade-ticket JSON  |

### 1.4 US stocks (`routes/stocks.ts`) — MOCKED

| Method | Path                            | Live? | Notes                                              |
| ------ | ------------------------------- | ----- | -------------------------------------------------- |
| GET    | `/api/stocks/quotes`            | NO    | Default US symbols from `STOCKS` map               |
| GET    | `/api/stocks/:symbol/history`   | NO    | `generatePriceHistory` synthesizes OHLC bars       |
| GET    | `/api/stocks/indices`           | NO    | S&P/Nasdaq/Dow/VIX/Russell — seeded random         |
| GET    | `/api/stocks/movers`            | NO    | derived from `STOCKS` mock                         |
| GET    | `/api/stocks/sectors`           | NO    | derived from `STOCKS` mock                         |
| GET    | `/api/watchlist`                | AUTH  | DB                                                 |
| POST   | `/api/watchlist`                | AUTH  | DB (UNIQUE user_id+symbol)                         |
| DELETE | `/api/watchlist/:id`            | AUTH  | DB                                                 |
| GET    | `/api/ai/analysis/:symbol`      | NO    | `getAiAnalysis` synthesized                        |
| GET    | `/api/ai/market-summary`        | NO    | `getAiMarketSummary` synthesized                   |

### 1.5 OpenAPI ↔ router parity

`lib/api-spec/openapi.yaml` lists **30 operations across 21 paths**. The
router implements more. The openapi spec is the **client-side codegen
source** (orval → react-query hooks); it intentionally **does not**
list auth endpoints because the client-side hooks would never call them
(the auth endpoints are reached through `AuthContext`, not through
generated hooks).

**Endpoints implemented but NOT in the spec:**
- `/api/auth/*` (8 paths) — intentional, handled by AuthContext
- `/api/decision-engine`
- `/api/gift-nifty/{quote,history,intraday}`
- `/api/nse/india-vix`
- `/api/nse/quote/:symbol`
- `/api/nse/history/:symbol`
- `/api/suggestions/{intraday,options}`
- `/api/commodities/history`
- `/api/global-index/{quote,history}`
- `/api/fo-analyzer`

The frontend uses the generated hooks only for endpoints in the spec
(watchlist, portfolio, upstox_settings, suggestions, insights, F&O), and
raw `fetch` for the rest. This is documented in
`lib/api-client-react/src/custom-fetch.ts`.

**Endpoints in the spec but NOT implemented in router:**
- `/healthz` (planned, not wired)
- `/api/admin/stats` (planned, not wired)

## 2. External data sources

### 2.1 NSE India (server-side, public)

Base URL: `https://www.nseindia.com/api/...`

The client uses a Chrome **User-Agent** + **Referer**
(`https://www.nseindia.com/`) headers because NSE blocks generic
clients. The Node HTTP client reuses these across calls.

| Endpoint                                | Used by                                |
| --------------------------------------- | -------------------------------------- |
| `/api/allIndices`                       | Gift Nifty quote, Sectors              |
| `/api/equity-stockIndices?index=...`    | Sectors                                |
| `/api/live-analysis-data` (intraday)    | Gift Nifty intraday (chart)            |
| `/api/marketData/getMCPUniversal?…`     | India VIX                              |

No NSE API key is needed (it's a public web app scraping their public
JSON). NSE has been known to rate-limit; the upstream-fetch helpers
catch errors and fall through to the next tier in
`liveMarketData.ts`.

### 2.2 Yahoo Finance 2 (`yahoo-finance2`, npm)

The server uses `yahoo-finance2` for:

- NSE-equity quotes (suffix `.NS`) — fallback when Upstox token is
  missing or upstream is down
- US-stock quotes (the only path right now — there is no live US
  source)
- Commodities futures (USD) — gold (`GC=F`), silver (`SI=F`),
  crude oil (`CL=F`), brent (`BZ=F`), natural gas (`NG=F`), copper
  (`HG=F`), platinum (`PL=F`), wheat (`ZW=F`), corn (`ZC=F`),
  soybean (`ZS=F`)
- Global indices: `^NYA` (NYSE), `000001.SS` (Shanghai), `^HSI`
  (Hang Seng), `^NSEI` (Nifty 50)

All Yahoo responses are cached 30-90 seconds in the in-process
TTLCache. The "Simulated" dataSource badge is shown whenever NSE +
Upstox + Yahoo all fail and we serve a hardcoded constant.

### 2.3 Upstox v2 (server-side, optional)

Base URL: `https://api.upstox.com/v2`

The bearer access token is stored **per user** in `upstox_settings`,
not globally. The code calls `db.upstoxSettings.findLatest()` to pick
the most recent row, then caches the access_token in module scope for
**5 minutes**. Every request sends:

```
Authorization: Bearer <access_token>
Api-Version: 2.0
Accept: application/json
```

| Upstox path                                              | Used by                                       |
| -------------------------------------------------------- | --------------------------------------------- |
| `/market-quote/quote?instrument_key=NSE_EQ\|SYMBOL`      | Per-symbol NSE quotes (Tier 1)                |
| `/market-quote/quote?instrument_key=NSE_INDEX\|<name>`   | Nifty 50 (Tier 1 for Gift Nifty)              |
| `/market-quote/multi-quote?instrument_key=NSE_EQ\|...`   | Movers batch                                  |
| `/historical-candle/{key}/{unit}/{interval}`             | (currently unused; reserved)                  |

`UPSTOX_API_KEY` env var is documented in `.env.example` but is not
yet referenced by any code — the per-user `access_token` is sufficient
for all current endpoints.

### 2.4 TradingView (browser-side, embed)

The Commodity AI Decision chart and SymbolView chart load
`https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js`
in the browser via a `<script>` tag. No server proxy. The widget
respects TradingView's free-embed licensing.

### 2.5 Email — SMTP / Nodemailer (`lib/email.ts`)

`lib/email.ts` does a **dynamic import** of `nodemailer` only when
`SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are all set. If they are not,
the helper logs the reset URL and returns `false`, and the
`/forgot-password` route falls back to (a) returning the URL in the
response when `NODE_ENV !== "production"` or `SHOW_RESET_LINK=true`,
and (b) the standard "If the email exists, a reset link was sent"
generic message in production.

When SMTP is configured the email is plain-text, contains the reset
URL, and has no HTML alternative. The SMTP connection is created
fresh per send; no pool is kept.

### 2.6 Other npm dependencies that touch the network

None. The codebase does **not** call:

- OpenAI / Anthropic / Gemini / Claude (no `openai`, `@anthropic-ai`,
  `@google/generative-ai` package imports)
- Stripe / Razorpay (no payment SDK present despite "Pro / Premium"
  tiers existing in `users.plan`)
- MongoDB Atlas (replaced by MySQL)
- Replit Object Storage / Database (`.replit` workflows exist but the
  deployed target is Hostinger)
- WebSocket providers

## 3. Frontend ↔ backend plumbing

### 3.1 OpenAPI → React Query codegen

```
lib/api-spec/openapi.yaml        (hand-authored source of truth)
        │
        ▼  orval
lib/api-zod/src/                 (Zod schemas, generated)
        │
        ▼  orval
lib/api-client-react/src/        (react-query hooks, generated)
        │
        ▼
artifacts/stock-dashboard/src/   (consumed by pages)
```

### 3.2 Custom fetcher (`lib/api-client-react/src/custom-fetch.ts`)

- Reads the base URL from a module-scoped variable set by
  `setBaseUrl()` (called by `AuthProvider` on mount with
  `window.location.origin + "/api"`).
- Reads the auth header from a module-scoped getter set by
  `setAuthTokenGetter()`. **The getter returns `null`**, so no
  Authorization header is ever sent — auth is cookie-only.
- Auto-parses JSON / text / blob.
- Throws a typed `ApiError<T>` (status + body) and a separate
  `ResponseParseError`.

### 3.3 Endpoint surface used by the client

The client calls **only** the path prefixes that the server actually
mounts. Direct `fetch()` calls are used for everything not in the
generated client (auth, gift nifty, decision engine, sectors, global
index, etc.).

## 4. Summary: live vs. mocked per data path

| Path                         | Live?                                  |
| ---------------------------- | -------------------------------------- |
| NSE indices (sectors, VIX)   | YES (NSE direct, then Yahoo)           |
| Gift Nifty quote             | YES (NSE direct → Upstox → Yahoo)      |
| Gift Nifty intraday          | YES (NSE direct)                       |
| NSE symbol quote             | YES (Upstox → Yahoo → simulated)       |
| NSE symbol history           | synthesized seeded walk                |
| US stocks                    | NO — synthetic (no live source wired)  |
| US indices                   | NO — synthetic                          |
| Commodities (USD futures)    | YES (Yahoo)                            |
| Commodities (MCX INR)        | derived from Yahoo + hardcoded FX rate |
| Global indices               | YES (Yahoo)                            |
| Stock "AI analysis"          | NO — synthetic                          |
| "AI market summary"          | NO — synthetic                          |
| Decision engine              | HEURISTIC over live Nifty quote        |
| Commodity AI Decision Engine | NO — 100% mock (PRNG)                  |
| Performance page             | NO — hardcoded `MOCK_TRADES`           |
| F&O Analyzer                 | HEURISTIC over user-supplied inputs    |
| Forgot-password email        | PARTIAL — depends on SMTP env vars     |