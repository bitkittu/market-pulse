import mysql, {
  type Pool,
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";

// ── Connection ──────────────────────────────────────────────────────────────
// Accept the common env-var names shared hosts inject for the connection
// string, but only ever use a value that is actually a mysql:// string — this
// avoids accidentally picking up a stale mongodb+srv:// URI from the old
// Atlas setup. Hosts that expose discrete credentials instead of a URL
// (Hostinger's MySQL panel does) are supported via DB_HOST/DB_USER/etc.
const URL_ENV_VARS = ["DATABASE_URL", "MYSQL_URL", "MYSQL_URI"] as const;

interface ConnectionConfig {
  uri?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

function resolveConnection(): ConnectionConfig {
  const present: { name: string; value: string }[] = [];
  for (const name of URL_ENV_VARS) {
    const value = process.env[name]?.trim();
    if (value) present.push({ name, value });
  }

  const url = present.find((c) => c.value.startsWith("mysql"));
  if (url) return { uri: url.value };

  // Fall back to discrete credentials before complaining about the URL.
  const host = process.env["DB_HOST"]?.trim() ?? process.env["MYSQL_HOST"]?.trim();
  const user = process.env["DB_USER"]?.trim() ?? process.env["MYSQL_USER"]?.trim();
  const database = process.env["DB_NAME"]?.trim() ?? process.env["MYSQL_DATABASE"]?.trim();
  if (host && user && database) {
    const rawPort = process.env["DB_PORT"]?.trim() ?? process.env["MYSQL_PORT"]?.trim();
    return {
      host,
      port: rawPort ? Number(rawPort) : 3306,
      user,
      password: process.env["DB_PASSWORD"]?.trim() ?? process.env["MYSQL_PASSWORD"]?.trim() ?? "",
      database,
    };
  }

  if (present.length > 0) {
    throw new Error(
      `Found ${present.map((c) => c.name).join(", ")} but no value is a mysql:// connection ` +
        `string. Set DATABASE_URL to your MySQL string (mysql://user:pass@host:3306/dbname). ` +
        `A leftover MongoDB URI will not work.`,
    );
  }

  throw new Error(
    `MySQL connection details missing. Set DATABASE_URL (checked: ${URL_ENV_VARS.join(", ")}) ` +
      `or DB_HOST/DB_USER/DB_NAME.`,
  );
}

let pool: Pool | null = null;

/**
 * Creates the connection pool and verifies it with a round-trip, so a bad
 * host/credential fails here at startup rather than on the first request.
 * Idempotent — safe to call more than once.
 */
export async function connectDb(): Promise<Pool> {
  if (pool) return pool;

  const config = resolveConnection();
  const created = config.uri
    ? mysql.createPool(config.uri)
    : mysql.createPool({
        host: config.host!,
        port: config.port!,
        user: config.user!,
        password: config.password!,
        database: config.database!,
      });

  // Prove the credentials work before we hand the pool out.
  const conn = await created.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }

  pool = created;
  return pool;
}

function getPool(): Pool {
  if (!pool) {
    throw new Error("Database not connected. connectDb() must be awaited at startup.");
  }
  return pool;
}

/** Everything this layer ever binds to a placeholder. */
type SqlParam = string | number | boolean | Date | null;

async function query(sql: string, params: SqlParam[] = []): Promise<RowDataPacket[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(sql, params);
  return rows;
}

async function execute(sql: string, params: SqlParam[] = []): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
}

// ── Row types ───────────────────────────────────────────────────────────────
export interface UserRow {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  roleId: number;
  plan: "free" | "pro" | "premium";
  status: "active" | "suspended";
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleRow {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: Date;
}

export interface WatchlistRow {
  id: number;
  userId: number;
  symbol: string;
  addedAt: Date;
}

export interface PortfolioRow {
  id: number;
  userId: number;
  symbol: string;
  exchange: string;
  buyPrice: number | null;
  quantity: number | null;
  addedAt: Date;
}

export interface UpstoxSettingsRow {
  id: number;
  userId: number;
  apiKey: string;
  apiSecret: string | null;
  clientId: string | null;
  accessToken: string | null;
  liveDataEnabled: boolean;
  connectedAt: Date;
}

export interface LoginHistoryRow {
  id: number;
  userId: number;
  ipAddress: string | null;
  userAgent: string | null;
  status: "success" | "failed";
  createdAt: Date;
}

export interface PasswordResetRow {
  id: number;
  userId: number;
  tokenHash: string; // sha256 of the raw token — the raw token is never stored
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

// ── Row decoders ────────────────────────────────────────────────────────────
// mysql2 hands back snake_case columns, DECIMAL as string, and tinyint(1) as
// 0/1, so each table gets an explicit decoder rather than a blanket cast.
type Raw = RowDataPacket;

function toUser(r: Raw): UserRow {
  return {
    id: Number(r["id"]),
    name: String(r["name"]),
    email: String(r["email"]),
    passwordHash: String(r["password_hash"]),
    roleId: Number(r["role_id"]),
    plan: r["plan"] as UserRow["plan"],
    status: r["status"] as UserRow["status"],
    emailVerifiedAt: (r["email_verified_at"] as Date | null) ?? null,
    lastLoginAt: (r["last_login_at"] as Date | null) ?? null,
    createdAt: r["created_at"] as Date,
    updatedAt: r["updated_at"] as Date,
  };
}

function toRole(r: Raw): RoleRow {
  const joined = r["permissions"];
  return {
    id: Number(r["id"]),
    name: String(r["name"]),
    description: (r["description"] as string | null) ?? null,
    permissions: typeof joined === "string" && joined.length > 0 ? joined.split(",") : [],
    createdAt: r["created_at"] as Date,
  };
}

function toWatchlist(r: Raw): WatchlistRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    symbol: String(r["symbol"]),
    addedAt: r["added_at"] as Date,
  };
}

function toPortfolio(r: Raw): PortfolioRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    symbol: String(r["symbol"]),
    exchange: String(r["exchange"]),
    buyPrice: r["buy_price"] === null ? null : Number(r["buy_price"]),
    quantity: r["quantity"] === null ? null : Number(r["quantity"]),
    addedAt: r["added_at"] as Date,
  };
}

function toUpstoxSettings(r: Raw): UpstoxSettingsRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    apiKey: String(r["api_key"]),
    apiSecret: (r["api_secret"] as string | null) ?? null,
    clientId: (r["client_id"] as string | null) ?? null,
    accessToken: (r["access_token"] as string | null) ?? null,
    liveDataEnabled: Boolean(r["live_data_enabled"]),
    connectedAt: r["connected_at"] as Date,
  };
}

function toPasswordReset(r: Raw): PasswordResetRow {
  return {
    id: Number(r["id"]),
    userId: Number(r["user_id"]),
    tokenHash: String(r["token_hash"]),
    expiresAt: r["expires_at"] as Date,
    usedAt: (r["used_at"] as Date | null) ?? null,
    createdAt: r["created_at"] as Date,
  };
}

/** One stored Holding Stocks pick, joined to the scan that produced it. */
export interface HoldingScanPickRow {
  symbol: string;
  name: string;
  scanPrice: number;
  score: number;
  classification: string;
  riskLevel: string;
  scannedAt: Date;
  universe: string;
}

// ── Query helpers ───────────────────────────────────────────────────────────
const ROLE_SELECT = `
  SELECT r.id, r.name, r.description, r.created_at,
         GROUP_CONCAT(p.name ORDER BY p.id) AS permissions
  FROM roles r
  LEFT JOIN role_permissions rp ON rp.role_id = r.id
  LEFT JOIN permissions p ON p.id = rp.permission_id
`;

export const db = {
  users: {
    async findById(id: number): Promise<UserRow | null> {
      const rows = await query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findByEmail(email: string): Promise<UserRow | null> {
      const rows = await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findByRoleId(roleId: number): Promise<UserRow | null> {
      const rows = await query("SELECT * FROM users WHERE role_id = ? LIMIT 1", [roleId]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async all(): Promise<UserRow[]> {
      const rows = await query("SELECT * FROM users ORDER BY id");
      return rows.map(toUser);
    },
    /** Returns the AUTO_INCREMENT id of the new row. */
    async insert(u: {
      name: string;
      email: string;
      passwordHash: string;
      roleId: number;
      plan: UserRow["plan"];
      status: UserRow["status"];
    }): Promise<number> {
      const res = await execute(
        `INSERT INTO users (name, email, password_hash, role_id, plan, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [u.name, u.email, u.passwordHash, u.roleId, u.plan, u.status],
      );
      return res.insertId;
    },
    async updateName(id: number, name: string): Promise<void> {
      await execute("UPDATE users SET name = ? WHERE id = ?", [name, id]);
    },
    async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
      await execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id]);
    },
    async updatePlan(id: number, plan: UserRow["plan"]): Promise<void> {
      await execute("UPDATE users SET plan = ? WHERE id = ?", [plan, id]);
    },
    async touchLastLogin(id: number): Promise<void> {
      await execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [id]);
    },
    async deleteById(id: number): Promise<void> {
      await execute("DELETE FROM users WHERE id = ?", [id]);
    },
  },

  roles: {
    async findById(id: number): Promise<RoleRow | null> {
      const rows = await query(`${ROLE_SELECT} WHERE r.id = ? GROUP BY r.id`, [id]);
      return rows[0] ? toRole(rows[0]) : null;
    },
    async findByName(name: string): Promise<RoleRow | null> {
      const rows = await query(`${ROLE_SELECT} WHERE r.name = ? GROUP BY r.id`, [name]);
      return rows[0] ? toRole(rows[0]) : null;
    },
    async all(): Promise<RoleRow[]> {
      const rows = await query(`${ROLE_SELECT} GROUP BY r.id ORDER BY r.id`);
      return rows.map(toRole);
    },
    async upsert(name: string, description: string): Promise<number> {
      await execute(
        `INSERT INTO roles (name, description) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [name, description],
      );
      const row = await this.findByName(name);
      return row!.id;
    },
    /** Replaces the role's permission set, creating any missing permissions. */
    async setPermissions(roleId: number, names: readonly string[]): Promise<void> {
      await execute("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);
      if (names.length === 0) return;
      for (const name of names) {
        await execute(
          `INSERT INTO permissions (name) VALUES (?)
           ON DUPLICATE KEY UPDATE name = VALUES(name)`,
          [name],
        );
      }
      const placeholders = names.map(() => "?").join(", ");
      await execute(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT ?, id FROM permissions WHERE name IN (${placeholders})`,
        [roleId, ...names],
      );
    },
    async describePermission(name: string, description: string): Promise<void> {
      await execute(
        `INSERT INTO permissions (name, description) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [name, description],
      );
    },
  },

  watchlist: {
    async findByUser(userId: number): Promise<WatchlistRow[]> {
      const rows = await query(
        "SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at",
        [userId],
      );
      return rows.map(toWatchlist);
    },
    async findOne(userId: number, symbol: string): Promise<WatchlistRow | null> {
      const rows = await query(
        "SELECT * FROM watchlist WHERE user_id = ? AND symbol = ? LIMIT 1",
        [userId, symbol],
      );
      return rows[0] ? toWatchlist(rows[0]) : null;
    },
    async insert(userId: number, symbol: string): Promise<WatchlistRow> {
      const res = await execute("INSERT INTO watchlist (user_id, symbol) VALUES (?, ?)", [
        userId,
        symbol,
      ]);
      const rows = await query("SELECT * FROM watchlist WHERE id = ?", [res.insertId]);
      return toWatchlist(rows[0]!);
    },
    async remove(userId: number, symbol: string): Promise<void> {
      await execute("DELETE FROM watchlist WHERE user_id = ? AND symbol = ?", [userId, symbol]);
    },
  },

  portfolio: {
    async findByUser(userId: number): Promise<PortfolioRow[]> {
      const rows = await query(
        "SELECT * FROM portfolio WHERE user_id = ? ORDER BY added_at",
        [userId],
      );
      return rows.map(toPortfolio);
    },
    async findOne(userId: number, symbol: string): Promise<PortfolioRow | null> {
      const rows = await query(
        "SELECT * FROM portfolio WHERE user_id = ? AND symbol = ? LIMIT 1",
        [userId, symbol],
      );
      return rows[0] ? toPortfolio(rows[0]) : null;
    },
    async insert(p: {
      userId: number;
      symbol: string;
      exchange: string;
      buyPrice: number | null;
      quantity: number | null;
    }): Promise<PortfolioRow> {
      const res = await execute(
        `INSERT INTO portfolio (user_id, symbol, exchange, buy_price, quantity)
         VALUES (?, ?, ?, ?, ?)`,
        [p.userId, p.symbol, p.exchange, p.buyPrice, p.quantity],
      );
      const rows = await query("SELECT * FROM portfolio WHERE id = ?", [res.insertId]);
      return toPortfolio(rows[0]!);
    },
    async remove(userId: number, symbol: string): Promise<void> {
      await execute("DELETE FROM portfolio WHERE user_id = ? AND symbol = ?", [userId, symbol]);
    },
  },

  upstoxSettings: {
    async findByUser(userId: number): Promise<UpstoxSettingsRow | null> {
      const rows = await query("SELECT * FROM upstox_settings WHERE user_id = ? LIMIT 1", [userId]);
      return rows[0] ? toUpstoxSettings(rows[0]) : null;
    },
    /** Most recently connected account, used for the shared server-side token. */
    async findLatest(): Promise<UpstoxSettingsRow | null> {
      const rows = await query("SELECT * FROM upstox_settings ORDER BY connected_at DESC LIMIT 1");
      return rows[0] ? toUpstoxSettings(rows[0]) : null;
    },
    async replace(s: {
      userId: number;
      apiKey: string;
      apiSecret: string | null;
      clientId: string | null;
      accessToken: string | null;
    }): Promise<UpstoxSettingsRow> {
      await execute("DELETE FROM upstox_settings WHERE user_id = ?", [s.userId]);
      const res = await execute(
        `INSERT INTO upstox_settings (user_id, api_key, api_secret, client_id, access_token)
         VALUES (?, ?, ?, ?, ?)`,
        [s.userId, s.apiKey, s.apiSecret, s.clientId, s.accessToken],
      );
      const rows = await query("SELECT * FROM upstox_settings WHERE id = ?", [res.insertId]);
      return toUpstoxSettings(rows[0]!);
    },
    async removeForUser(userId: number): Promise<void> {
      await execute("DELETE FROM upstox_settings WHERE user_id = ?", [userId]);
    },
  },

  loginHistory: {
    async record(entry: {
      userId: number;
      ipAddress: string | null;
      userAgent: string | null;
      status: LoginHistoryRow["status"];
    }): Promise<void> {
      await execute(
        `INSERT INTO login_history (user_id, ip_address, user_agent, status)
         VALUES (?, ?, ?, ?)`,
        [entry.userId, entry.ipAddress, entry.userAgent, entry.status],
      );
    },
  },

  passwordResets: {
    async findUnusedByTokenHash(tokenHash: string): Promise<PasswordResetRow | null> {
      const rows = await query(
        "SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL LIMIT 1",
        [tokenHash],
      );
      return rows[0] ? toPasswordReset(rows[0]) : null;
    },
    async insert(r: { userId: number; tokenHash: string; expiresAt: Date }): Promise<void> {
      await execute(
        "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        [r.userId, r.tokenHash, r.expiresAt],
      );
    },
    async markUsed(id: number): Promise<void> {
      await execute("UPDATE password_resets SET used_at = NOW() WHERE id = ?", [id]);
    },
    async clearOutstanding(userId: number): Promise<void> {
      await execute("DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL", [userId]);
    },
    /** MySQL has no TTL index, so expired rows are swept on demand. */
    async purgeExpired(): Promise<void> {
      await execute("DELETE FROM password_resets WHERE expires_at < NOW()");
    },
  },

  /**
   * Holding Stocks scan history. Schema lives in lib/db/holding_stocks.sql and
   * is applied by hand like the rest of this project's DDL — callers are
   * expected to tolerate these tables being absent.
   */
  holdingScans: {
    /** Idempotent per (universe, scanned_at) so a repeated scan updates in place. */
    async upsertScan(s: {
      universe: string;
      scannedAt: Date;
      pickCount: number;
    }): Promise<number> {
      await execute(
        `INSERT INTO holding_scans (universe, scanned_at, pick_count)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE pick_count = VALUES(pick_count)`,
        [s.universe, s.scannedAt, s.pickCount],
      );
      const rows = await query(
        "SELECT id FROM holding_scans WHERE universe = ? AND scanned_at = ? LIMIT 1",
        [s.universe, s.scannedAt],
      );
      return Number(rows[0]!["id"]);
    },

    async upsertPick(p: {
      scanId: number;
      symbol: string;
      name: string;
      scanPrice: number;
      score: number;
      scoreComponents: string;
      classification: string;
      riskLevel: string;
      reasons: string;
    }): Promise<void> {
      await execute(
        `INSERT INTO holding_scan_picks
           (scan_id, symbol, name, scan_price, score, score_components,
            classification, risk_level, reasons)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           scan_price = VALUES(scan_price),
           score = VALUES(score),
           score_components = VALUES(score_components),
           classification = VALUES(classification),
           risk_level = VALUES(risk_level),
           reasons = VALUES(reasons)`,
        [
          p.scanId, p.symbol, p.name, p.scanPrice, p.score, p.scoreComponents,
          p.classification, p.riskLevel, p.reasons,
        ],
      );
    },

    /** Symbols picked by the most recent scan strictly before `before`. */
    async previousScanSymbols(universe: string, before: Date): Promise<string[]> {
      const rows = await query(
        `SELECT p.symbol
         FROM holding_scan_picks p
         JOIN holding_scans s ON s.id = p.scan_id
         WHERE s.universe = ?
           AND s.scanned_at = (
             SELECT MAX(scanned_at) FROM holding_scans
             WHERE universe = ? AND scanned_at < ?
           )`,
        [universe, universe, before],
      );
      return rows.map((r) => String(r["symbol"]));
    },

    async recentPicks(limit: number): Promise<HoldingScanPickRow[]> {
      const rows = await query(
        `SELECT p.symbol, p.name, p.scan_price, p.score, p.classification,
                p.risk_level, s.scanned_at, s.universe
         FROM holding_scan_picks p
         JOIN holding_scans s ON s.id = p.scan_id
         ORDER BY s.scanned_at DESC, p.score DESC
         LIMIT ?`,
        [limit],
      );
      return rows.map((r) => ({
        symbol: String(r["symbol"]),
        name: String(r["name"]),
        scanPrice: Number(r["scan_price"]),
        score: Number(r["score"]),
        classification: String(r["classification"]),
        riskLevel: String(r["risk_level"]),
        scannedAt: r["scanned_at"] as Date,
        universe: String(r["universe"]),
      }));
    },
  },
};
