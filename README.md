# Market Pulse AI

Internal-trading dashboard. React 19 + Vite SPA on the front, an
Express 5 + MySQL backend, deployed on Hostinger. Live NSE / Upstox /
Yahoo Finance integration; everything else (US stocks, the "AI" pages)
is documented as-is — see [`docs/FEATURE_STATUS.md`](./docs/FEATURE_STATUS.md)
for the honest list of what's live vs. mocked.

---

## Documentation

| Document                                             | What it covers                                              |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| [`docs/PROJECT_OVERVIEW.md`](./docs/PROJECT_OVERVIEW.md) | What the product is, top-level architecture, tech stack |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)     | Topology diagram, data flow, build/deploy pipeline           |
| [`docs/FEATURE_STATUS.md`](./docs/FEATURE_STATUS.md) | Every feature tagged COMPLETE / PARTIAL / MOCK / PLACEHOLDER  |
| [`docs/DATABASE.md`](./docs/DATABASE.md)             | MySQL schema, query helpers, migration story                 |
| [`docs/API_INTEGRATIONS.md`](./docs/API_INTEGRATIONS.md) | Every internal route + every external data source         |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)         | Local dev, build, Hostinger production                      |
| [`docs/KNOWN_ISSUES.md`](./docs/KNOWN_ISSUES.md)     | Security / correctness / scaling debt                        |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md)               | P0/P1/P2/P3 priorities                                      |

---

## Quick start (local development)

Prerequisites: Node.js 24+, pnpm 9+, MySQL 8 (local or LAN).

```bash
pnpm install
cp .env.example .env                                  # then edit credentials
mysql -u <user> -p <dbname> < lib/db/nse_pulse_hostinger.sql
pnpm run dev
```

The first backend boot creates roles, permissions, and an admin user
from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Log in immediately and change
the password.

See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for production
deploys (Hostinger + nginx + PM2).

---

## Tech stack

- **Frontend** — React 19.1, TypeScript 5.9, Vite 7, Tailwind 4.1,
  TanStack React Query 5.90, recharts, framer-motion, Radix UI
  primitives + shadcn/ui ("new-york")
- **Backend** — Node 24+, Express 5, TypeScript, esbuild (ESM output)
- **DB** — MySQL via `mysql2` (no ORM)
- **Auth** — bcryptjs (cost 10) + jsonwebtoken (HS256, 30-day
  httpOnly cookie)
- **Live data** — NSE India (direct HTTP), Upstox v2 (per-user bearer
  token), Yahoo Finance 2 (npm), TradingView public embed widget
- **Codegen** — OpenAPI 3.1 → Orval → React-Query hooks + Zod schemas
- **Logging** — Pino structured + `pino-http` middleware
- **Process** — PM2 fork, 1 instance; nginx reverse proxy + SPA fallback

---

## Layout

```
artifacts/
  api-server/         # Express backend
  stock-dashboard/    # React SPA
lib/
  db/                 # mysql2 pool + typed query helpers + SQL file
  api-spec/           # OpenAPI 3.1 source of truth
  api-zod/            # generated Zod schemas
  api-client-react/   # generated React-Query hooks + custom-fetch
  integrations/       # reserved
scripts/              # build helpers
docs/                 # this documentation set
```

---

## Status snapshot

> Full detail in [`docs/FEATURE_STATUS.md`](./docs/FEATURE_STATUS.md).

- **28 COMPLETE** — auth, RBAC, watchlist, portfolio, admin user CRUD,
  live Gift Nifty, NSE sectors, Upstox settings, global indices,
  TradingView chart
- **21 PARTIAL** — forgot/reset password (needs SMTP), portfolio live
  P&L, decision engine (heuristic, not ML), NSE history (synthesized),
  mobile-responsive
- **8 MOCK** — US stocks, US indices, "AI market summary", "stock AI
  analysis", Performance page (`MOCK_TRADES`), all parts of the
  Commodity AI Decision Engine
- **40 PLACEHOLDER** — admin AI/News/APIs/Plans/Feedback/Reports/Audit
  + 31 Market Hub leaves (5 markets × 7 sections, minus the 3 live +
  1 mock)

---

## License

Proprietary / unlicensed. Do not redistribute without permission.