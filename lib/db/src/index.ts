import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const neonUrl = process.env.NEON_DATABASE_URL;
const connectionString = neonUrl ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// When using Neon, pass ssl as a Pool-level option (rejectUnauthorized: false).
// This overrides sslmode from the URL without mangling the connection string.
export const pool = new Pool({
  connectionString,
  ssl: neonUrl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
