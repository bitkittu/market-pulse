# Market Pulse AI — Feature Status

> Every feature documented against the actual source code. Tags:
> - **COMPLETE** — wired end-to-end and serving real data through the full
>   stack as designed
> - **PARTIAL** — core implementation present but with gaps, caveats, or
>   fallbacks to simulated data
> - **PLACEHOLDER** — UI shell exists, but the page body is `<ComingSoonPage>`
>   or a "coming soon" placeholder component with no real backend
> - **MOCK** — UI is fully built, but the data is fabricated client-side or
>   server-side via seeded PRNG / hardcoded constants
> - **BROKEN** — code exists but does not work as intended (see
>   [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md))
> - **PLANNED** — referenced in copy or roadmap, not started

---

## Project Status Matrix

| #  | Feature                              | Status        | Path / Component                                                  | Live data source                                  |
| -- | ------------------------------------ | ------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| 1  | Registration                         | COMPLETE      | `routes/auth.ts:53`, `pages/Register.tsx`                         | MySQL `users`                                     |
| 2  | Login                                | COMPLETE      | `routes/auth.ts:108`, `pages/Login.tsx`                          | MySQL `users`, `login_history`                    |
| 3  | Logout                               | COMPLETE      | `routes/auth.ts:314`, `AuthContext.logout`                        | clears cookie                                     |
| 4  | Forgot password                      | PARTIAL       | `routes/auth.ts:164`, `pages/ForgotPassword.tsx`                  | depends on SMTP config (optional)                 |
| 5  | Reset password                       | COMPLETE      | `routes/auth.ts:221`, `pages/ResetPassword.tsx`                  | MySQL `password_resets`                           |
| 6  | Change password                      | COMPLETE      | `routes/auth.ts:281`                                              | MySQL `users.password_hash`                       |
| 7  | Update profile (name)                | COMPLETE      | `routes/auth.ts:256`                                              | MySQL `users.name`                                |
| 8  | Session management                   | COMPLETE      | `lib/auth.ts:51`, cookie `mp_session` 30-day                      | JWT HS256                                         |
| 9  | Roles & permissions                  | COMPLETE      | `lib/auth.ts:9-27`, `routes/admin.ts`                             | MySQL `roles`, `role_permissions`, `permissions`  |
| 10 | First admin auto-seed                 | COMPLETE      | `lib/auth.ts:147`                                                 | env `ADMIN_EMAIL`, `ADMIN_PASSWORD`               |
| 11 | Account suspension                   | COMPLETE      | `routes/auth.ts:134`                                              | MySQL `users.status`                              |
| 12 | Login history                        | COMPLETE      | `routes/auth.ts:121-141`                                          | MySQL `login_history`                             |
| 13 | Watchlist CRUD                       | COMPLETE      | `routes/stocks.ts:108-133`                                        | MySQL `watchlist`                                 |
| 14 | Portfolio CRUD                       | COMPLETE      | `routes/nse.ts:149-218`                                           | MySQL `portfolio`                                 |
| 15 | Portfolio live P&L                   | PARTIAL       | `pages/Portfolio.tsx`                                             | stock-indicators endpoint (server-derived)        |
| 16 | Admin: list users                    | COMPLETE      | `routes/admin.ts:9`                                               | MySQL                                             |
| 17 | Admin: change user plan              | COMPLETE      | `routes/admin.ts:49`                                              | MySQL `users.plan`                                |
| 18 | Admin: delete user                   | COMPLETE      | `routes/admin.ts:21`                                              | MySQL                                             |
| 19 | Admin: dashboard overview            | PARTIAL       | `pages/AdminPanel.tsx:50`                                         | users count real; revenue + system health mocked  |
| 20 | Admin: AI Settings / News / APIs / Plans / Feedback / Reports / Audit | PLACEHOLDER | `pages/AdminPanel.tsx:220` `PlaceholderView` × 7 | hardcoded text          |
| 21 | Landing page                         | PARTIAL       | `pages/LandingPage.tsx`                                           | hardcoded arrays                                  |
| 22 | Home / Dashboard                     | PARTIAL       | `pages/Home.tsx`                                                  | real: decision, gift nifty, sectors, global; mock: dashboard layouts persistence path  |
| 23 | Market Hub navigation                | COMPLETE      | `AppSidebar.tsx`, `BottomNav.tsx`, `lib/marketHub.ts`             | config-driven                                     |
| 24 | Intraday dashboard                   | COMPLETE      | `pages/IntradayDashboard.tsx`, `/suggestions/intraday`            | `/nse/*` endpoints + seeded history               |
| 25 | Options dashboard                    | COMPLETE      | `pages/OptionsDashboard.tsx`, `/suggestions/options`              | `/suggestions/options` (synthesized signals)      |
| 26 | Commodities dashboard                | COMPLETE      | `pages/Commodities.tsx`, `/commodities`                           | Yahoo Finance (futures USD) + INR conversion      |
| 27 | **Commodity AI Decision Engine**     | **MOCK**      | `pages/CommodityAIDecisionEngine.tsx`, `components/ai-commodity/data.ts` | seeded PRNG; only the **TradingView chart** is live |
| 28 | Decision Engine panel                | PARTIAL       | `/decision-engine`, `lib/decisionEngine.ts`                       | NSE live for nifty; pivot math + seeded money flow |
| 29 | F&O Analyzer                         | PARTIAL       | `/fo-analyzer`, `pages/FoAnalyzer.tsx`                            | server heuristic on user-supplied inputs          |
| 30 | Insights (stock search + news)       | PARTIAL       | `/insights/search`, `pages/Insights.tsx`                          | stock indicators + canned news templates          |
| 31 | Performance analytics                | MOCK          | `pages/Performance.tsx`                                           | `MOCK_TRADES` array hardcoded in component        |
| 32 | Gift Nifty quote                     | COMPLETE      | `/gift-nifty/quote`, `lib/liveMarketData.ts`                      | NSE → Upstox → Yahoo (3-tier)                     |
| 33 | Gift Nifty history                   | PARTIAL       | `/gift-nifty/history`                                             | synthesized from current price + seed             |
| 34 | Gift Nifty intraday                  | COMPLETE      | `/gift-nifty/intraday`                                            | NSE direct `chart-databyindex`                    |
| 35 | NSE market movers                    | COMPLETE      | `/nse/movers`                                                     | Upstox batch → Yahoo chunks                       |
| 36 | NSE sector performance               | COMPLETE      | `/nse/sectors`                                                    | NSE → Upstox → Yahoo                              |
| 37 | India VIX                            | PARTIAL       | `/nse/india-vix`                                                  | NSE first, hardcoded fallback (14.82)             |
| 38 | NSE symbol quote                     | PARTIAL       | `/nse/quote/:symbol`                                              | Upstox → Yahoo → simulated                        |
| 39 | NSE symbol history                   | PARTIAL       | `/nse/history/:symbol`                                            | synthesized                                       |
| 40 | Global index quotes                  | COMPLETE      | `/global-index/quote`                                             | Yahoo (^NYA, 000001.SS, ^HSI, ^NSEI only)         |
| 41 | Global index history                 | COMPLETE      | `/global-index/history`                                           | Yahoo                                             |
| 42 | Commodities (10 symbols)             | COMPLETE      | `/commodities`                                                    | Yahoo Finance + INR conversion                    |
| 43 | Commodity history                    | COMPLETE      | `/commodities/history`                                            | Yahoo (allow-listed symbols)                      |
| 44 | Upstox settings CRUD                 | COMPLETE      | `/settings/upstox/*`                                              | MySQL `upstox_settings`                           |
| 45 | Upstox connection test               | COMPLETE      | `/settings/upstox/test`                                           | calls Upstox with saved access_token              |
| 46 | Plan gating                          | PARTIAL       | `lib/plan.ts`                                                     | Pro/Premium price = "Coming soon"                 |
| 47 | Dashboard custom layouts             | PARTIAL       | `lib/dashboardLayout.ts`, `useDashboardLayouts`                   | localStorage-persisted (no server)                |
| 48 | Price alerts (browser notification)  | PARTIAL       | `pages/Home.tsx:AlertSystem`                                      | polls Gift Nifty, browser-only notification        |
| 49 | Symbol view (per-symbol page)        | PARTIAL       | `pages/SymbolView.tsx`                                            | depends on `/stocks/quotes` (US-only mock data)   |
| 50 | US stocks quotes                     | MOCK          | `/stocks/quotes`, `lib/stockData.js`                              | synthesized from `STOCKS` map + seeded random     |
| 51 | US stocks history                    | MOCK          | `/stocks/:symbol/history`                                         | `generatePriceHistory` (synthesized)              |
| 52 | US indices (S&P/Nasdaq/Dow/VIX/Russell) | MOCK       | `/stocks/indices`                                                 | baseValue × (1 + seededRandom * 3 - 1.44)%       |
| 53 | US stocks movers/sectors             | MOCK          | `/stocks/movers`, `/stocks/sectors`                               | derived from `STOCKS` mock                        |
| 54 | Stock AI analysis                    | MOCK          | `/stocks/ai/analysis/:symbol`                                     | `getAiAnalysis` synthesized                       |
| 55 | AI market summary                    | MOCK          | `/stocks/ai/market-summary`                                       | `getAiMarketSummary` synthesized                  |
| 56 | Market Hub: Dashboard (all markets)  | PLACEHOLDER   | `<ComingSoonPage />` × 4 markets                                  | n/a                                               |
| 57 | Market Hub: Learn                    | PLACEHOLDER   | `<ComingSoonPage />`                                              | n/a                                               |
| 58 | Market Hub: Indicators               | PLACEHOLDER   | `<ComingSoonPage />`                                              | n/a                                               |
| 59 | Market Hub: AI Decision (non-commodities) | PLACEHOLDER | `<ComingSoonPage />` × 4                                          | n/a                                               |
| 60 | Market Hub: Screeners                | PLACEHOLDER   | `<ComingSoonPage />`                                              | n/a                                               |
| 61 | Market Hub: Strategies               | PLACEHOLDER   | `<ComingSoonPage />`                                              | n/a                                               |
| 62 | Market Hub: Reports                  | PLACEHOLDER   | `<ComingSoonPage />`                                              | n/a                                               |
| 63 | Email (SMTP)                         | PARTIAL       | `lib/email.ts`                                                    | gated on SMTP_HOST/USER/PASS env vars             |
| 64 | Theme (dark / light)                 | COMPLETE      | `App.tsx:applyTheme`, localStorage `nse-theme`                    | client-side                                       |
| 65 | IST clock + market-open badge        | COMPLETE      | `App.tsx:ISTClock`                                                | client-side                                       |
| 66 | Mobile responsive                    | COMPLETE      | `BottomNav.tsx`, all pages use `sm:` / `md:` / `lg:` breakpoints   | n/a                                               |

---

## 1. Authentication & account management (COMPLETE/PARTIAL)

- **Registration, login, logout, /me, change-password, update-profile**:
  fully wired end-to-end. Validation, hashing, session cookie, role
  attach, and login_history record are all in place
  (`routes/auth.ts:53-321`).
- **Forgot/reset password**: complete in code; **only the email delivery
  is optional**. Until SMTP_HOST / SMTP_USER / SMTP_PASS are set, the
  reset URL is logged server-side and optionally returned in the response
  (gated on `NODE_ENV !== "production"` or `SHOW_RESET_LINK=true`).
- **Account suspension**: server checks `user.status === "active"` on every
  `requireAuth`.
- **Roles & permissions**: seeded by `seedAuthDefaults`. The admin role
  has all 7 permissions; the user role has 4. Admin-only routes
  (`/admin/*`) double-gate with `requirePermission`.

## 2. User-facing data features

### 2.1 Live data (COMPLETE)

These endpoints hit upstream sources (NSE direct, Upstox, Yahoo Finance)
with a 3-tier fallback chain in `lib/liveMarketData.ts`. Each response
carries a `dataSource` field that the UI surfaces as a small badge
("NSE Live" / "Upstox Live" / "Yahoo ~15m" / "Simulated").

| Endpoint                         | Primary  | Fallback 1 | Fallback 2      |
| -------------------------------- | -------- | ---------- | --------------- |
| `/gift-nifty/quote`              | NSE      | Upstox     | Yahoo Finance   |
| `/gift-nifty/intraday`           | NSE      | (closed)   | (closed)        |
| `/nse/india-vix`                 | NSE      | hardcoded  | n/a             |
| `/nse/movers`                    | Upstox   | Yahoo      | simulated       |
| `/nse/sectors`                   | NSE      | Upstox     | Yahoo           |
| `/nse/quote/:symbol`             | Upstox   | Yahoo      | simulated       |
| `/commodities`                   | Yahoo    | synthesized | n/a            |
| `/commodities/history`           | Yahoo    | (error 500) | n/a            |
| `/global-index/quote`            | Yahoo    | (error 500) | n/a            |
| `/global-index/history`          | Yahoo    | (error 500) | n/a            |

### 2.2 Synthesized data (PARTIAL)

These endpoints run heuristics over real or hardcoded inputs but **do
not** fetch a true upstream:

- `/decision-engine` — heuristic on the live Gift Nifty quote (so the
  base price IS live; the signals, R:R, and confidence are derived).
- `/nse/history/:symbol` — synthesized price series from the current
  `getNseQuote(symbol)` price + a deterministic seeded walk.
- `/gift-nifty/history` — same shape; seeded from current price.
- `/suggestions/intraday` and `/suggestions/options` — server-side
  suggestions over `NSE_STOCKS` map.

### 2.3 Mocked (no real data path)

- `/stocks/quotes` — default US symbols `AAPL, MSFT, GOOGL, AMZN, TSLA,
  META, NVDA, NFLX, JPM, JNJ` all read from the `STOCKS` map in
  `lib/stockData.js`. There is **no** live US-stock feed wired.
- `/stocks/:symbol/history` — `generatePriceHistory()` synthesizes
  daily OHLC bars.
- `/stocks/indices` — S&P / Nasdaq / Dow / VIX / Russell are seeded
  random from `baseValue * (1 + (r-0.48)*3)%`.
- `/stocks/ai/*` — synthesized from the `STOCKS` map and a daily seed.

### 2.4 Commodity AI Decision Engine — 100% MOCK

- **Data**: hardcoded `BASE_PRICES` (e.g. gold ₹71,500), seeded PRNG
  recommendation, sentiment, and news.
- **Chart**: TradingView widget on the international spot/futures
  equivalent (`TVC:GOLD`, `TVC:SILVER`, `TVC:USOIL`,
  `OANDA:NATGASUSD`), not MCX.
- **Risk panel**: real math (lot sizing, R:R) but uses the mock entry /
  target.
- **Disclaimer (printed in the component footer)**:
  *"AI recommendations and market data on this page are illustrative
  placeholders for demonstrating the interface — not live trading
  signals. Live data integration is planned for a future release."*

### 2.5 Performance page (MOCK)

`pages/Performance.tsx` ships a hardcoded `MOCK_TRADES` array of 20
historical trades (RELIANCE, TCS, INFY, …) and computes win rate, best /
worst trade, weekly bar chart and cumulative P&L line chart purely
client-side from that array. No persistence, no real trade history.

## 3. Admin Panel (mixed)

The admin panel route (`AdminPanel.tsx`) replaces the entire user shell
when `user.role === "admin"`. It has 10 sidebar entries:

| Section                | Status        | Notes                                                                |
| ---------------------- | ------------- | -------------------------------------------------------------------- |
| Dashboard              | PARTIAL       | Total/Pro/Premium/Free counts from `allUsers()` (real); revenue + system health hardcoded |
| User Management        | COMPLETE      | List, search, change plan, delete (real backend)                     |
| System Monitor         | MOCK          | CPU 23%, Memory 61%, Requests 342/min, Sessions 18 — all hardcoded  |
| AI Model Settings      | PLACEHOLDER   | "Coming soon" pill                                                   |
| News Sources           | PLACEHOLDER   | "Coming soon" pill                                                   |
| Market APIs            | PLACEHOLDER   | "Coming soon" pill                                                   |
| Subscription Plans     | PLACEHOLDER   | "Coming soon" pill                                                   |
| Feedback               | PLACEHOLDER   | "Coming soon" pill                                                   |
| Reports                | PLACEHOLDER   | "Coming soon" pill                                                   |
| Audit Logs             | PLACEHOLDER   | "Coming soon" pill                                                   |

The **delete** action confirms via `window.confirm` and is blocked for
admin accounts (server-side too — see `routes/admin.ts:35`).

## 4. Market Hub (5 markets × 7 sections = 35 leaves)

|                     | Intraday | Options | Commodities | Forex | Crypto |
| ------------------- | :------: | :-----: | :---------: | :---: | :----: |
| **Dashboard**       | LIVE     | LIVE    | LIVE        | CS    | CS     |
| **Learn**           | CS       | CS      | CS          | CS    | CS     |
| **Indicators**      | CS       | CS      | CS          | CS    | CS     |
| **AI Decision**     | CS       | CS      | MOCK AI     | CS    | CS     |
| **Screeners**       | CS       | CS      | CS          | CS    | CS     |
| **Strategies**      | CS       | CS      | CS          | CS    | CS     |
| **Reports**         | CS       | CS      | CS          | CS    | CS     |

`LIVE` = real page, `MOCK AI` = Commodity AI Decision Engine (mocked),
`CS` = `<ComingSoonPage />`.

Total: 3 LIVE, 1 MOCK AI, 31 Coming-Soon leaves.

## 5. Feature counts (summary)

| Tag         | Count |
| ----------- | ----- |
| COMPLETE    | 28    |
| PARTIAL     | 21    |
| MOCK        | 8     |
| PLACEHOLDER  | 9 (admin) + 31 (market hub) = 40 |
| BROKEN      | 0     |
| PLANNED     | 0 (everything in copy is either placeholder or in progress) |

## 6. The "AI" claim — re-stated for clarity

The product brands itself as "AI-powered". The following components do
**not** call any AI provider:

- "AI Market Analysis" (landing page claim)
- "AI Decision Engine" (entire page)
- "AI Recommendation Card" (commodity)
- "Stock Insights" AI summary
- "AI Market Summary" (dashboard hero)
- "F&O Analyzer" (server-side heuristic)

What "AI" actually means in this codebase is one of:

1. **Pivot-point math** (decision engine)
2. **Deterministic seeded PRNG** (commodity AI page, performance page)
3. **Server-side heuristics** over real NSE data
   (`getIntradaySuggestions`, `getOptionsSuggestions`, `analyzeFoTrade`)

A future integration with OpenAI, Anthropic, or another LLM provider is
**not** present in the code.