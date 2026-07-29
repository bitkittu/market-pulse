# Market Pulse AI — Database

> The data layer is **MySQL** via the `mysql2` Node driver. There is no
> ORM, no migration tool — only a single hand-authored SQL file plus
> typed query helpers in `lib/db/src/index.ts`.

---

## 1. Connection configuration

Resolved at server boot by `connectDb()` in `lib/db/src/index.ts`.

```ts
// env precedence:  DATABASE_URL > MYSQL_URL > MYSQL_URI > DB_HOST/DB_USER/etc.
// the URL form must begin with "mysql" — anything else (in particular
// mongodb+srv://) is rejected with a clear error message
```

`.env.example` documents both forms:

```bash
# URL form
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DBNAME

# OR discrete credentials (Hostinger's hPanel format)
DB_HOST=localhost
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
```

The first call to `connectDb()` opens the pool and runs `await
conn.ping()` against it. If the pool can't connect, the Express server
refuses to start (`index.ts:16-37`) — this is deliberate so that the
process is fail-fast instead of a site that loads but 500s every
request.

## 2. Migration story

| Era            | Database                | Status                              |
| -------------- | ----------------------- | ----------------------------------- |
| Original       | MongoDB Atlas           | replaced                            |
| Current        | **Hostinger MySQL**     | shipped, working                    |

The original codebase talked to MongoDB Atlas. The migration is
complete; **no MongoDB driver, Mongoose schema, or `mongodb+srv://`
URI is referenced anywhere in the code except as a deliberate rejection
in `lib/db/src/index.ts:50-54`**.

The schema file is `lib/db/nse_pulse_hostinger.sql` — it intentionally
**does not** include `CREATE DATABASE` or `USE` because on shared
Hostinger MySQL the panel pre-creates the database and the user's MySQL
account only has access to that one database. To install:

1. In hPanel phpMyAdmin, select the database from the sidebar.
2. Open the **Import** tab.
3. Upload `nse_pulse_hostinger.sql` and run it.

After import the server's first boot (`seedAuthDefaults()`) populates
the `roles`, `permissions`, `role_permissions` tables and creates the
first admin user from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## 3. Schema

12 tables. PK types: `int unsigned AUTO_INCREMENT` for RBAC tables,
`bigint unsigned AUTO_INCREMENT` for user-scoped tables.

### 3.1 Roles & permissions

```sql
CREATE TABLE `roles` (
  id INT UNSIGNED PK,
  name VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE `permissions` (
  id INT UNSIGNED PK,
  name VARCHAR(100) UNIQUE NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE `role_permissions` (
  role_id INT UNSIGNED,
  permission_id INT UNSIGNED,
  PRIMARY KEY (role_id, permission_id),
  -- FKs added later (see §5)
);
```

Seeded permissions (7):

| Permission           | Description                                       |
| -------------------- | ------------------------------------------------- |
| `users.manage`       | Create, update, delete user accounts              |
| `users.view`         | View user accounts                                |
| `dashboard.view`     | View the trading dashboard                        |
| `watchlist.manage`   | Add/remove watchlist symbols                      |
| `portfolio.manage`   | Add/remove portfolio holdings                     |
| `settings.manage`    | Manage own account/API settings                   |
| `system.monitor`     | View system health / admin monitor panel          |

Seeded roles (2):

- `admin` — all 7 permissions
- `user` — `dashboard.view`, `portfolio.manage`, `watchlist.manage`,
  `settings.manage`

### 3.2 Users

```sql
CREATE TABLE `users` (
  id BIGINT UNSIGNED PK,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT UNSIGNED NOT NULL,
  plan ENUM('free','pro','premium') DEFAULT 'free',
  status ENUM('active','suspended') DEFAULT 'active',
  email_verified_at TIMESTAMP NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now() ON UPDATE CURRENT_TIMESTAMP,
  FK role_id → roles(id)
);

CREATE TABLE `user_profiles` (
  id BIGINT UNSIGNED PK,
  user_id BIGINT UNIQUE NOT NULL,
  avatar_url VARCHAR(500),
  phone VARCHAR(20),
  bio VARCHAR(500),
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now() ON UPDATE CURRENT_TIMESTAMP,
  FK user_id → users(id) ON DELETE CASCADE
);
```

### 3.3 Auth: sessions, resets, verification

```sql
CREATE TABLE `login_history` (
  id BIGINT UNSIGNED PK,
  user_id BIGINT NOT NULL,        -- FK → users(id) CASCADE
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  status ENUM('success','failed') NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE `password_resets` (
  id BIGINT UNSIGNED PK,
  user_id BIGINT NOT NULL,        -- FK → users(id) CASCADE
  token_hash CHAR(64) NOT NULL,   -- SHA-256 hex of the raw token
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE `remember_tokens` (
  id BIGINT UNSIGNED PK,
  user_id BIGINT NOT NULL,        -- FK → users(id) CASCADE
  selector CHAR(24) UNIQUE NOT NULL,
  validator_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE `email_verifications` (
  id BIGINT UNSIGNED PK,
  user_id BIGINT NOT NULL,        -- FK → users(id) CASCADE
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT now()
);
```

Note: `remember_tokens` and `email_verifications` tables exist in the
schema but the current code **does not use them** (sessions are JWT
cookies, not persistent tokens, and the registration flow does not send
a verification email). The migration is forward-looking.

### 3.4 App data

```sql
CREATE TABLE `watchlist` (
  id BIGINT UNSIGNED PK,
  user_id BIGINT NOT NULL,        -- FK → users(id) CASCADE
  symbol VARCHAR(30) NOT NULL,
  added_at TIMESTAMP DEFAULT now(),
  UNIQUE KEY uq_watchlist_user_symbol (user_id, symbol)
);

CREATE TABLE `portfolio` (
  id BIGINT UNSIGNED PK,
  user_id BIGINT NOT NULL,        -- FK → users(id) CASCADE
  symbol VARCHAR(30) NOT NULL,
  exchange VARCHAR(10) NOT NULL DEFAULT 'NSE',
  buy_price DECIMAL(14,4) NULL,
  quantity INT NULL,
  added_at TIMESTAMP DEFAULT now(),
  UNIQUE KEY uq_portfolio_user_symbol (user_id, symbol)
);

CREATE TABLE `upstox_settings` (
  id BIGINT UNSIGNED PK,
  user_id BIGINT UNIQUE NOT NULL,  -- FK → users(id) CASCADE
  api_key VARCHAR(255) NOT NULL,
  api_secret VARCHAR(255) NULL,
  client_id VARCHAR(100) NULL,
  access_token VARCHAR(500) NULL,
  live_data_enabled BOOLEAN DEFAULT TRUE,
  connected_at TIMESTAMP DEFAULT now()
);
```

**Credentials are stored in plaintext** (`api_key`, `api_secret`,
`access_token`) in `upstox_settings`. There is no symmetric encryption
at the application level. See
[`KNOWN_ISSUES.md §2`](./KNOWN_ISSUES.md#2-plaintext-upstox-credentials).

## 4. Query helpers (`lib/db/src/index.ts`)

A single exported object `db` with one helper per table. All helpers
use `?` placeholders via `mysql2/promise`'s `execute`/`query`. Row
decoders are explicit per-table because mysql2 hands back snake_case
columns, DECIMAL as string, and tinyint(1) as 0/1.

### 4.1 Module shape

```ts
export const db = {
  users:         { findById, findByEmail, findByRoleId, all, insert,
                   updateName, updatePasswordHash, updatePlan,
                   touchLastLogin, deleteById },
  roles:         { findById, findByName, all, upsert, setPermissions,
                   describePermission },
  watchlist:     { findByUser, findOne, insert, remove },
  portfolio:     { findByUser, findOne, insert, remove },
  upstoxSettings:{ findByUser, findLatest, replace, removeForUser },
  loginHistory:  { record },
  passwordResets:{ findUnusedByTokenHash, insert, markUsed,
                   clearOutstanding, purgeExpired },
};
```

### 4.2 Notable behaviours

- **`db.roles.setPermissions(roleId, names)`**: deletes the existing
  rows in `role_permissions` for that role, upserts every permission
  name into `permissions`, then bulk-inserts new mappings. This is what
  `seedAuthDefaults` uses on every boot.
- **`db.upstoxSettings.findLatest()`**: returns the row with the most
  recent `connected_at`. The single Upstox bearer token shared across
  the server comes from here (cached 5 minutes in
  `lib/upstoxClient.ts`).
- **`db.upstoxSettings.replace({ userId, ... })`**: deletes the existing
  row for `userId` and inserts a new one. There is at most one row per
  user (UNIQUE on `user_id`).
- **`db.passwordResets.purgeExpired()`**: MySQL has no TTL index, so
  expired rows are swept on demand (called from `forgot-password`).
- **`db.passwordResets.findUnusedByTokenHash(hash)`**: looks up the
  reset row, then the caller checks `expiresAt.getTime() < Date.now()`
  before acting.

### 4.3 Row decoders

```ts
function toUser(r: Raw): UserRow {
  return {
    id: Number(r["id"]),
    name: String(r["name"]),
    email: String(r["email"]),
    passwordHash: String(r["password_hash"]),
    roleId: Number(r["role_id"]),
    plan: r["plan"] as "free" | "pro" | "premium",
    status: r["status"] as "active" | "suspended",
    emailVerifiedAt: (r["email_verified_at"] as Date | null) ?? null,
    lastLoginAt: (r["last_login_at"] as Date | null) ?? null,
    createdAt: r["created_at"] as Date,
    updatedAt: r["updated_at"] as Date,
  };
}
// …toRole, toWatchlist, toPortfolio, toUpstoxSettings, toPasswordReset
```

The decoded shapes (`UserRow`, `RoleRow`, `WatchlistRow`, etc.) are
exported and used by `api-server` as the typed return shape of every
query helper.

## 5. Foreign keys (post-import)

The schema file uses `SET FOREIGN_KEY_CHECKS = 0;` before table
creation and adds FK constraints after:

```sql
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_roles_id_fk
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_permission_id_permissions_id_fk
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE users ADD CONSTRAINT users_role_id_roles_id_fk
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_users_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
-- login_history, password_resets, remember_tokens, email_verifications,
-- watchlist, portfolio, upstox_settings  →  users(id) ON DELETE CASCADE
```

The final line of the schema re-enables FK checks
(`SET FOREIGN_KEY_CHECKS = 1;`).

## 6. Indexes

| Table              | Indexes                                                          |
| ------------------ | ---------------------------------------------------------------- |
| roles              | PK id, UNIQUE name                                               |
| permissions        | PK id, UNIQUE name                                               |
| role_permissions   | PK (role_id, permission_id)                                      |
| users              | PK id, UNIQUE email, FK role_id                                  |
| user_profiles      | PK id, UNIQUE user_id, FK user_id                               |
| login_history      | PK id, FK user_id                                                |
| password_resets    | PK id, FK user_id                                                |
| remember_tokens    | PK id, UNIQUE selector, FK user_id                               |
| email_verifications| PK id, FK user_id                                                |
| watchlist          | PK id, UNIQUE (user_id, symbol), FK user_id                      |
| portfolio          | PK id, UNIQUE (user_id, symbol), FK user_id                      |
| upstox_settings    | PK id, UNIQUE user_id, FK user_id                                |

There are **no** indexes added beyond those required by UNIQUE/PK.
Common query patterns (filtering login_history by user, listing a
user's watchlist by added_at) rely on the FK + small per-user dataset.

## 7. Admin first-run seed

On the first ever boot, `seedAuthDefaults()` runs:

```ts
for (const permission of DEFAULT_PERMISSIONS) {
  await db.roles.describePermission(permission.name, permission.description);
}
for (const role of DEFAULT_ROLES) {
  const roleId = await db.roles.upsert(role.name, role.description);
  await db.roles.setPermissions(roleId, ROLE_PERMISSIONS[role.name]);
}
const adminRole = await db.roles.findByName("admin");
if (!adminRole) return;
const existingAdmin = await db.users.findByRoleId(adminRole.id);
if (existingAdmin) return;                  // idempotent
await db.users.insert({
  name: "Admin",
  email: process.env.ADMIN_EMAIL ?? "team@trading.brandmars.com",
  passwordHash: await hashPassword(process.env.ADMIN_PASSWORD ?? "Admin@123"),
  roleId: adminRole.id,
  plan: "premium",                            // first admin gets premium
  status: "active",
});
```

> The auto-created admin is granted **`plan = 'premium'`** — so any
> feature that becomes paid in the future will be unlocked for this
> account on day one.

## 8. Operational notes

- **No connection pooling beyond mysql2's default** (10 connections).
  No tuning is done; for a single-instance prod this is sufficient.
- **No query metrics / slow query log** is configured.
- **No automated backups** are configured at the application level;
  rely on Hostinger's MySQL backup cadence.
- **No migrations directory** — schema changes are made by editing
  `nse_pulse_hostinger.sql` and re-importing. This is a known
  limitation; see [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md).
- **No healthcheck endpoint** — the only `/healthz` is in
  `openapi.yaml` as a planned path; the router doesn't implement it
  yet.