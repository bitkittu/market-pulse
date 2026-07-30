# Market Pulse AI — Deployment

> Everything required to take a fresh checkout to "running in production
> on Hostinger". Two target environments: **local development** (Windows
> or POSIX) and **Hostinger production**.

---

## 1. Repository

```
D:\Projects\market-pulse
├── artifacts/
│   ├── api-server/           # Express backend (esbuild bundles ESM)
│   └── stock-dashboard/      # React 19 SPA (Vite)
├── lib/
│   ├── db/                   # mysql2 pool + typed table helpers + SQL file
│   ├── api-spec/             # OpenAPI 3.1 source of truth
│   ├── api-zod/              # generated Zod schemas (codegen output)
│   ├── api-client-react/     # generated React-Query hooks + custom-fetch
│   └── integrations/         # (reserved for future integrations)
├── scripts/                  # build helpers
├── docs/                     # this documentation set
├── .replit                   # Replit workflow definitions
├── .env.example
├── ecosystem.config.cjs      # PM2 config
├── nginx.conf                # reverse proxy + SPA fallback
├── package.json              # pnpm workspace root
└── pnpm-workspace.yaml
```

The pnpm workspace catalog pins every shared dependency version in one
place; all `lib/*` and `artifacts/*` packages consume them by name only.

## 2. Local development

### 2.1 Prerequisites

| Tool         | Version    | Why                                  |
| ------------ | ---------- | ------------------------------------ |
| Node.js      | 24+        | backend runs on 24                    |
| pnpm         | 9+         | workspace install                    |
| MySQL 8      | local or LAN | backend uses mysql2 pool           |

### 2.2 First-time setup

```bash
pnpm install
cp .env.example .env                  # then edit credentials
```

Import the schema:

```bash
mysql -u <DB_USER> -p <DB_NAME> < lib/db/nse_pulse_hostinger.sql
```

Start both dev processes:

```bash
pnpm run dev
```

This runs both `vite` (frontend, :22996) and `tsx watch src/index.ts`
(backend, :3001) in parallel. The Vite dev server proxies `/api/*` to
the backend.

### 2.3 Useful scripts

| Command               | What it does                                              |
| --------------------- | --------------------------------------------------------- |
| `pnpm run dev`        | Vite + tsx watch in parallel                              |
| `pnpm run build`      | Vite build → `artifacts/stock-dashboard/dist/public`      |
| `pnpm run build:api`  | esbuild bundle → `artifacts/api-server/dist/index.mjs`    |
| `pnpm run build:deploy` | runs both in sequence                                   |
| `pnpm run gen:api`    | re-run Orval codegen against `openapi.yaml`               |
| `pnpm run typecheck`  | `tsc -b` across the workspace                             |
| `pnpm run lint`       | ESLint (if configured)                                    |

### 2.4 Hot reload

- Frontend: Vite HMR, instant.
- Backend: `tsx watch` restarts on any `src/**/*.ts` change.
- Schema: manual — edit the SQL file, re-import.

## 3. Environment variables

Defined in `.env.example`. **All values for production live in hPanel,
not in `.env`.** `.env` is git-ignored.

| Var                 | Required?         | Default                      | Used by                                 |
| ------------------- | ----------------- | ---------------------------- | --------------------------------------- |
| `PORT`              | no                | `3001`                       | api-server                              |
| `NODE_ENV`          | no                | `development`                | api-server                              |
| `DATABASE_URL`      | one of these      | —                            | `connectDb()`                           |
| `MYSQL_URL`         | alternative       | —                            | `connectDb()`                           |
| `DB_HOST`           | one of these      | `localhost`                  | `connectDb()`                           |
| `DB_PORT`           | no                | `3306`                       | `connectDb()`                           |
| `DB_USER`           | yes (if no URL)   | —                            | `connectDb()`                           |
| `DB_PASSWORD`       | yes (if no URL)   | —                            | `connectDb()`                           |
| `DB_NAME`           | yes (if no URL)   | —                            | `connectDb()`                           |
| `JWT_SECRET`        | **yes**           | — (server refuses to start) | `signJwt()`, `verifyJwt()`              |
| `ADMIN_EMAIL`       | yes for seed      | `team@marketpulse.learninhome.com` | `seedAuthDefaults()`                    |
| `ADMIN_PASSWORD`    | yes for seed      | `Admin@123`                  | `seedAuthDefaults()`                    |
| `APP_BASE_URL`      | yes in prod       | `http://localhost:3001`      | reset password email link               |
| `SMTP_HOST`         | for email         | —                            | `lib/email.ts`                          |
| `SMTP_PORT`         | no                | `587`                        | `lib/email.ts`                          |
| `SMTP_USER`         | for email         | —                            | `lib/email.ts`                          |
| `SMTP_PASS`         | for email         | —                            | `lib/email.ts`                          |
| `SMTP_FROM`         | no                | `SMTP_USER`                  | `lib/email.ts`                          |
| `SHOW_RESET_LINK`   | for dev reset UX  | `false`                      | `/auth/forgot-password` fallback        |
| `UPSTOX_API_KEY`    | reserved          | —                            | (currently unused)                      |
| `FRONTEND_DIST`     | override          | (computed from bundle path)  | `app.ts` SPA fallback                   |

**Secrets never printed**: `lib/auth.ts:getJwtSecret()` throws if
`JWT_SECRET` is missing; it never logs the value.

## 4. Production build

```bash
pnpm install --frozen-lockfile
pnpm run build:deploy
```

Output:

```
artifacts/api-server/dist/index.mjs
artifacts/stock-dashboard/dist/public/
```

The backend bundles everything (Express, mysql2, pino, nodemailer when
invoked, etc.) into a single ESM file with linked sourcemaps. The
exceptions listed in `artifacts/api-server/build.mjs:30-105` are
externalised (mostly cloud SDKs and native-binary packages that aren't
in this stack).

`mysql2` is bundled (was previously externalised — see commit history).
`pino` is wired up with `esbuild-plugin-pino` so logging keeps working
under ESM.

## 5. Hostinger production deploy

### 5.1 Deploy topology

```
   GitHub (origin/main)
        │  push
        ▼
   Hostinger auto-build (Node 24, pnpm install, pnpm build:deploy)
        │
        ▼
   artifacts/api-server/dist/index.mjs   ──▶  PM2  (market-pulse-api)
   artifacts/stock-dashboard/dist/public/ ──▶  nginx  (static + SPA fallback)
```

### 5.2 PM2 (`ecosystem.config.cjs`)

```js
module.exports = {
  apps: [{
    name: "market-pulse-api",
    script: "./artifacts/api-server/dist/index.mjs",
    instances: 1,
    exec_mode: "fork",
    env: { NODE_ENV: "production", PORT: 3001 },
  }],
};
```

PM2 is started by the Hostinger entrypoint script and supervised on
process exit.

### 5.3 nginx (`nginx.conf`)

```nginx
root /var/www/market-pulse/artifacts/stock-dashboard/dist/public;
index index.html;

# gzip + 1y immutable cache for hashed Vite assets
# ...
location /api/ {
  proxy_pass http://127.0.0.1:3001;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
}
location / {
  try_files $uri $uri/ /index.html;     # SPA fallback
}
```

`app.set("trust proxy", 1)` on the Express side ensures `req.ip`
reflects the real client.

### 5.4 Env var contract for hPanel

Set every variable from §3 in the Hostinger hPanel "Environment
variables" section. They are injected into the Node process at PM2
boot. There is no `.env` file in production.

### 5.5 Schema import

Manual, one-time per environment:

1. Open hPanel → Databases → MySQL → phpMyAdmin
2. Select the database from the sidebar
3. **Import** → choose `lib/db/nse_pulse_hostinger.sql` → **Go**

On the next API-server boot, `seedAuthDefaults()` populates roles,
permissions, role_permissions, and creates the first admin from
`ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### 5.6 First login

Log in as the seeded admin and **change the password immediately**.
The default password (`Admin@123`) is in plain text in
`lib/auth.ts:147` and in `.env.example`; it cannot be considered secret.

## 6. Local production-equivalent smoke test

After `pnpm run build:deploy`:

```bash
NODE_ENV=production \
JWT_SECRET=$(openssl rand -hex 32) \
DATABASE_URL=mysql://USER:PASS@localhost:3306/DBNAME \
APP_BASE_URL=http://localhost:3001 \
ADMIN_EMAIL=you@example.com \
ADMIN_PASSWORD=$(openssl rand -base64 24) \
node artifacts/api-server/dist/index.mjs &
cd artifacts/stock-dashboard/dist/public && python3 -m http.server 8080
```

Then `http://localhost:8080` should serve the SPA, and requests to
`/api/*` will go to the standalone backend (note: cookies won't cross
the ports unless you use a unified origin in production).

## 7. CI / future work

There is currently **no GitHub Actions workflow** in the repo. The
Hostinger deploy hook treats the repo as "build on push". Recommended
additions (not implemented):

- typecheck + lint on PR
- esbuild dry-run + tsc --noEmit in CI
- A health-check route (`/api/healthz`) so PM2 can detect dead workers
- A migrations directory (currently absent) so the schema can be
  versioned independently of `.sql` re-imports

## 8. Replit workflows (development only)

`.replit` defines:

- `api-server` — `pnpm run dev:api`, port 8080
- `stock-dashboard` — `pnpm run dev:web`, port 22996
- `mockup` — a legacy mockup workspace on port 8081 (not built or
  deployed in production)

`.replit` exists for development convenience. **Replit is not the
production host** and the only Replit-specific Vite plugins in the
catalog are gated behind `REPL_ID` checks; they are inert in any
other environment.

## 9. Backups and rollback

- **Database**: rely on Hostinger's MySQL backup cadence; the app does
  not configure its own backups.
- **Code**: rollback = `git revert` + push. Hostinger will rebuild
  with the reverted tree.
- **Migrations**: there is no automatic rollback path; the SQL file
  must be re-edited and re-imported.