# Market Pulse AI — Known Issues & Technical Debt

> Concrete defects and limitations found in the codebase, classified by
> severity and grouped by area. Each item points to the file or
> component to inspect.

---

## 1. Security

### 1.1 Plaintext Upstox credentials (HIGH)

`upstox_settings.api_key`, `api_secret`, `client_id`, and
`access_token` are stored in MySQL **as plain text**. The DB file is
backed up at the Hostinger cadence; backups are a credential-exfil
vector. Mitigation options:

- encrypt at rest with an application-level secret
- column-level encryption in MySQL
- delegate to a vault (doppler, hashicorp, etc.)

### 1.2 Wide-open CORS (MEDIUM)

`artifacts/api-server/src/app.ts:18` calls `app.use(cors())` with no
allow-list. In practice this is acceptable because the production
deployment is served behind nginx from a single origin — but if the
backend is ever exposed to a different origin it becomes an
exploit-target. Should be locked to the deployment origin in
production.

### 1.3 Reset-token rate-limit is per-process (MEDIUM)

`routes/auth.ts:forgot-password` enforces "5 per 15 min per (IP, email)"
via an in-process `Map`. Under multi-instance deploys (currently `PM2
fork, instances=1`, but scaling is documented as a next step), each
worker has its own counter — an attacker can scale to N× the
documented limit by forcing rotation. Fix: externalise to Redis or
the MySQL `password_resets` table itself.

### 1.4 Forgot-password user-enumeration via SHOW_RESET_LINK (LOW)

`/api/auth/forgot-password` always returns a generic "if the email
exists, a link was sent" message in production. When `NODE_ENV !==
"production"` or `SHOW_RESET_LINK=true`, it includes a `devResetUrl`
in the response — leaking whether the email is registered. The
release-time configuration MUST keep `NODE_ENV=production` and
`SHOW_RESET_LINK` unset in hPanel; if a developer ever flips it for
debugging, an attacker on the same network can enumerate accounts.

### 1.5 Default admin password in source (HIGH)

`lib/auth.ts:147` falls back to `Admin@123` if `ADMIN_PASSWORD` is not
set, and `.env.example` documents the same value. **The first boot
creates an admin user with a publicly known password.** Mitigation:
the seeded admin must change the password immediately after first
login; the constant should be removed in favour of a hard-fail when
`ADMIN_PASSWORD` is missing.

### 1.6 JWT_SECRET fallback not enforced at boot (LOW)

`getJwtSecret()` throws if `JWT_SECRET` is unset, but if it's set to an
empty string, `JWT_SECRET=""` is not rejected. The Express server will
start with a known-empty signing key. `.env.example` shows the
correct shape (`change-this-to-a-long-random-string`) but the server
does not enforce minimum length or complexity. Fix: refuse to boot
when `JWT_SECRET.length < 32`.

### 1.7 No CSRF token on state-changing routes (MEDIUM)

Cookie auth is `sameSite=lax` which mitigates the most common CSRF
attacks, but state-changing routes (`POST /api/portfolio`,
`DELETE /api/watchlist/:id`, `PATCH /api/auth/profile`, etc.) do not
carry an anti-CSRF token. If `sameSite` is ever weakened to `none`
(for cross-origin demo), CSRF becomes trivial. Fix: add a CSRF token
rotated per session and checked on every state-changing request.

### 1.8 No security headers (LOW)

`helmet` is not installed. The Express server does not set
`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, or `Content-Security-Policy`. nginx might be
configured to add some, but the application has none as a fallback.
Fix: install `helmet` and add a CSP that allows TradingView's embed
domain.

### 1.9 XSS in error messages (LOW)

The API responses echo error messages back to the client (`{ error:
"Failed to fetch: <details>" }` in `routes/nse.ts`). The frontend
renders these with React's default escaper so this is currently safe,
but a future refactor that introduces `dangerouslySetInnerHTML` would
turn these into XSS vectors.

## 2. Correctness

### 2.1 US stocks are entirely synthetic (HIGH for product positioning)

`routes/stocks.ts` and `lib/stockData.js` generate all US-stock
quotes, indices, history, movers, sectors, and AI summaries from a
hardcoded `STOCKS` map + seeded PRNG. There is no live data source for
US equities wired anywhere. The user-facing "Live US markets" copy
contradicts the implementation. Fix: wire a real US-data source
(Alpha Vantage, Polygon, Twelve Data) or change the copy to "Demo".

### 2.2 Commodity AI Decision Engine is 100% mock (HIGH for product positioning)

See [`FEATURE_STATUS.md §2.4`](./FEATURE_STATUS.md#24-commodity-ai-decision-engine--100-mock).
The footer disclaimer is the only thing preventing this from being
outright deceptive. To become a real product feature:

1. Replace `BASE_PRICES` with live MCX prices via Upstox (commodity
   segment) or NSE commodity feed.
2. Replace the seeded recommendation engine with either (a) a real ML
   model or (b) a documented deterministic rule with traceable logic.
3. Keep the TradingView widget (already live), but bind it to the MCX
   instrument key when Upstox is connected.

### 2.3 Dashboard widgets silently fall back (MEDIUM)

The 3-tier fallback (NSE → Upstox → Yahoo → simulated) does not surface
to the user when tier 1 is unavailable. The UI shows "Yahoo ~15m" or
"Simulated" badges, but the failed tier is not logged to a metric.
Recommendation: emit a counter (`upstream_failure_total{source=...}`)
per tier failure to a pino destination or metrics endpoint.

### 2.4 Decision-engine "money flow" is seeded (MEDIUM)

`lib/decisionEngine.ts:calcMoneyFlow` uses seeded random for
`volumeSpike` and `oiChange` rather than real NSE volume data. The
"Decision Engine" panel claims these are live and they're not. Fix:
replace with NSE bulk-deal data or Upstox market depth.

### 2.5 Email verification table exists but flow is not wired (LOW)

The `email_verifications` table exists and the helpers exist, but
registration does not enqueue or send a verification email. The
`users.email_verified_at` column stays NULL indefinitely.

### 2.6 Remember-me tokens exist but flow is not wired (LOW)

The `remember_tokens` table exists with `(selector, validator_hash)`
columns, but no code path reads or writes it. Session lifetime is
controlled entirely by the JWT cookie's `exp`.

### 2.7 Plan gating not enforced (LOW)

`users.plan` exists with three tiers (`free`, `pro`, `premium`) and
`lib/plan.ts` on the frontend defines `FREE_ACCESS`, but no backend
middleware reads `user.plan` to gate routes. All "Pro/Premium" pages
are accessible from a free account; only the UI ribbon says "Coming
soon" for paid features. This is fine **as long as** there is no
paid feature, but becomes a bug the day a paid feature ships.

### 2.8 /api/ai/analysis/:symbol synthesizes different values on the same day (LOW)

`getAiAnalysis` uses `new Date().toISOString().slice(0,10)` as a seed
**plus** the symbol, so analysis is stable per symbol per day. However
the underlying quote (`getStockQuote`) is also synthetic, so the whole
chain is fictional — the stability doesn't add real value.

## 3. Performance & scaling

### 3.1 In-process TTLCache not shared across instances (MEDIUM)

`lib/liveMarketData.ts` keeps a single `TTLCache` in module scope.
Under multi-instance deployment, every cache miss is repeated per
worker. Not a problem today (single instance), but a real concern when
scaling out. Fix: Redis or stick to a single instance.

### 3.2 Per-user Upstox token via findLatest() (LOW)

`db.upstoxSettings.findLatest()` returns the most recently connected
user's token, regardless of who's calling. So user A's quote request
might use user B's token. This is fine functionally (Upstox quotes are
not user-scoped), but it's surprising and means the "test connection"
on settings only validates the most recently connected token. Fix:
filter by `user_id` for any per-user endpoint.

### 3.3 Commodity history endpoint is unhandled (MEDIUM)

`/api/commodities/history` calls `yahooF.history()` directly without a
simulated fallback. If Yahoo returns an error, the user sees a 500
with no graceful degradation. Other commodity endpoints simulate a
last-resort response.

### 3.4 Missing HTTP caching (LOW)

The Express server does not send `Cache-Control` headers. The
nginx config sets a 1-year cache for hashed Vite assets but `/api/*`
responses are not cached anywhere. For an API that serves the same
quote every 30 seconds, an `s-maxage=15` would offload significantly.

## 4. Reliability

### 4.1 No automated backups (MEDIUM)

The application does not configure MySQL backups; relies on
Hostinger's default cadence. Acceptable for a hobby project; not for a
production app with user data.

### 4.2 No healthcheck endpoint (LOW)

`/api/healthz` is in `openapi.yaml` but not implemented. PM2 keeps
the process "online" even if the Express request loop is deadlocked.
A working healthcheck would let PM2 auto-restart and nginx route away.

### 4.3 No graceful shutdown (LOW)

The server's `index.ts` does not install a SIGTERM handler that drains
in-flight requests or closes the mysql2 pool cleanly. PM2 sends
SIGINT on reload, the process exits abruptly. Fix: install
`process.on("SIGTERM", ...)` that awaits pool.end() and a server.close().

### 4.4 `decisionCache` is module-scoped (LOW)

Same family as §3.1. `decisionCache` is a per-process `Map` with
60s TTL. Acceptable for one instance.

## 5. Maintainability

### 5.1 No migrations directory (MEDIUM)

`lib/db/nse_pulse_hostinger.sql` is a single hand-authored file. Any
schema change requires editing the file and re-importing via
phpMyAdmin. There is no version control of the live schema, no rollback
script, no upgrade-detection. Fix: introduce a `migrations/` directory
with a small Node script that runs files in lexical order and records
applied filenames in a `_migrations` table.

### 5.2 Codegen drift risk (MEDIUM)

The React-Query client is generated from `openapi.yaml`, but the
backend implements endpoints **not** in the spec (decision engine,
gift nifty, sectors, global index, fo-analyzer, etc.). The
custom-fetch falls back to raw `fetch()` for those, but a future
contributor who assumes the spec is complete will miss them.

### 5.3 OpenAPI path operations drift (LOW)

`openapi.yaml` lists 30 operations; the server implements more.
There's no test or script that verifies the spec covers the server.

### 5.4 Documentation as in-component prose (LOW)

Key business rules (e.g. "All India VIX fetches use NSE first, hardcoded
14.82 fallback", "Decision engine uses seeded money flow") live only as
comments in the source. A new contributor would need to read the code
to learn the rules. The docs in `docs/` (this directory) now cover
most of it, but the in-code comments are the only authoritative
source.

### 5.5 Magic strings scattered (LOW)

Permission names (`"users.manage"`, `"users.view"`, etc.) and role
names (`"admin"`, `"user"`) appear as string literals across multiple
files. A shared `constants/permissions.ts` would prevent typos and let
find-references work.

### 5.6 Decision-engine copy doesn't match implementation (LOW)

UI text in `DecisionEnginePanel` claims live signals. Code is seeded.
See §2.4.

## 6. UX gaps

- **No "live" indicator on the SymbolView chart** — the TradingView
  embed has its own status badge but the wrapping UI does not surface
  data freshness (last tick time, stale-fallback warning).
- **Forgot-password email copy** when SMTP is missing tells the user
  "an email was sent" but the user never receives anything; only the
  server log has the link.
- **Admin "System Monitor" page** shows fabricated CPU/memory metrics.
- **Market Hub sidebar** shows PAID badge on free-tier pages for
  Pro/Premium users without explaining that the page is still a
  placeholder.

## 7. Build & infrastructure

- `mysql2` was previously listed as an external for esbuild. Recent
  commit history confirms it's now bundled correctly — verify on
  deploy that no `Cannot find module 'mysql2'` error appears.
- `.replit` and the `@replit/*` Vite plugins in the workspace catalog
  are config-only and inert outside Replit; consider removing for
  clarity.
- `drizzle-orm` is in the pnpm catalog but **unused** anywhere in the
  source. Can be removed.
- No GitHub Actions workflow; CI/typecheck-on-PR is not configured.
- No error-tracking service (Sentry, Rollbar) is wired.

---

## Severity summary

| Severity | Count | Areas                                 |
| -------- | ----: | ------------------------------------- |
| HIGH     | 3     | plaintext Upstox creds, default admin password, US stocks synthetic, Commodity AI mock |
| MEDIUM   | 9     | CORS, CSRF, rate-limit per-process, mock US data, mock decision engine, multi-instance cache, no backups, no migrations, codegen drift |
| LOW      | 15    | enumeration, JWT_SECRET validation, XSS, version drift, doc density, magic strings, etc. |