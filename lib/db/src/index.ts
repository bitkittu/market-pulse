import { MongoClient, type Db, type Collection } from "mongodb";

// ── Connection ──────────────────────────────────────────────────────────────
// Accept the common env-var names various hosts inject for the connection
// string (Hostinger's managed MongoDB connector adds one automatically), but
// only ever use a value that is actually a mongodb:// string — this avoids
// accidentally picking up a stale MySQL DATABASE_URL from an earlier setup.
const URI_ENV_VARS = [
  "MONGODB_URI",
  "MONGODB_URL",
  "MONGO_URL",
  "MONGO_URI",
  "DATABASE_URL",
] as const;

function resolveMongoUri(): string {
  const present: { name: string; value: string }[] = [];
  for (const name of URI_ENV_VARS) {
    const value = process.env[name]?.trim();
    if (value) present.push({ name, value });
  }

  const mongo = present.find((c) => c.value.startsWith("mongodb"));
  if (mongo) return mongo.value;

  if (present.length > 0) {
    throw new Error(
      `Found ${present.map((c) => c.name).join(", ")} but no value is a mongodb:// connection ` +
        `string. Set MONGODB_URI to your Atlas string (mongodb+srv://...). ` +
        `A leftover MySQL DATABASE_URL will not work.`,
    );
  }

  throw new Error(
    `MongoDB connection string missing. Set MONGODB_URI (checked: ${URI_ENV_VARS.join(", ")}).`,
  );
}

const uri = resolveMongoUri();

// The connection string may not include a database name, so it is configurable
// separately. Defaults to "nse_pulse".
const dbName = process.env.MONGODB_DB ?? process.env.MONGODB_DATABASE ?? "nse_pulse";

export const client = new MongoClient(uri);

let connected: Db | null = null;

/**
 * Connects to MongoDB (idempotent) and ensures indexes. Call once at startup
 * before serving requests.
 */
export async function connectDb(): Promise<Db> {
  if (connected) return connected;
  await client.connect();
  connected = client.db(dbName);
  await ensureIndexes(connected);
  return connected;
}

function getDb(): Db {
  if (!connected) {
    throw new Error("Database not connected. connectDb() must be awaited at startup.");
  }
  return connected;
}

// ── Document types ──────────────────────────────────────────────────────────
export interface UserDoc {
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
export type UserRow = UserDoc;

export interface RoleDoc {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: Date;
}

export interface WatchlistDoc {
  id: number;
  userId: number;
  symbol: string;
  addedAt: Date;
}

export interface PortfolioDoc {
  id: number;
  userId: number;
  symbol: string;
  exchange: string;
  buyPrice: number | null;
  quantity: number | null;
  addedAt: Date;
}

export interface UpstoxSettingsDoc {
  id: number;
  userId: number;
  apiKey: string;
  apiSecret: string | null;
  clientId: string | null;
  accessToken: string | null;
  liveDataEnabled: boolean;
  connectedAt: Date;
}

export interface LoginHistoryDoc {
  id: number;
  userId: number;
  ipAddress: string | null;
  userAgent: string | null;
  status: "success" | "failed";
  createdAt: Date;
}

export interface PasswordResetDoc {
  id: number;
  userId: number;
  tokenHash: string; // sha256 of the raw token — the raw token is never stored
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

interface CounterDoc {
  _id: string;
  seq: number;
}

// ── Collection accessors ────────────────────────────────────────────────────
export const collections = {
  users: (): Collection<UserDoc> => getDb().collection<UserDoc>("users"),
  roles: (): Collection<RoleDoc> => getDb().collection<RoleDoc>("roles"),
  watchlist: (): Collection<WatchlistDoc> => getDb().collection<WatchlistDoc>("watchlist"),
  portfolio: (): Collection<PortfolioDoc> => getDb().collection<PortfolioDoc>("portfolio"),
  upstoxSettings: (): Collection<UpstoxSettingsDoc> =>
    getDb().collection<UpstoxSettingsDoc>("upstox_settings"),
  loginHistory: (): Collection<LoginHistoryDoc> =>
    getDb().collection<LoginHistoryDoc>("login_history"),
  passwordResets: (): Collection<PasswordResetDoc> =>
    getDb().collection<PasswordResetDoc>("password_resets"),
  counters: (): Collection<CounterDoc> => getDb().collection<CounterDoc>("counters"),
};

/**
 * Atomically returns the next sequential integer id for a named sequence,
 * preserving the auto-increment numeric ids the app and frontend expect.
 */
export async function nextId(name: string): Promise<number> {
  const res = await collections.counters().findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return res!.seq;
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("users").createIndex({ id: 1 }, { unique: true }),
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("roles").createIndex({ id: 1 }, { unique: true }),
    db.collection("roles").createIndex({ name: 1 }, { unique: true }),
    db.collection("watchlist").createIndex({ userId: 1, symbol: 1 }, { unique: true }),
    db.collection("portfolio").createIndex({ userId: 1, symbol: 1 }, { unique: true }),
    db.collection("upstox_settings").createIndex({ userId: 1 }, { unique: true }),
    db.collection("login_history").createIndex({ userId: 1 }),
    db.collection("password_resets").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("password_resets").createIndex({ userId: 1 }),
    // TTL index: MongoDB auto-removes reset docs once expiresAt passes.
    db.collection("password_resets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
