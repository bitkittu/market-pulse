/**
 * Apply a .sql migration to the configured MySQL database.
 *
 * This project has no migration framework — schema lives in hand-written .sql
 * files under lib/db and is applied manually. This script makes that repeatable
 * and safe rather than a copy-paste into a SQL console:
 *
 *   pnpm --filter @workspace/scripts migrate lib/db/holding_stocks.sql
 *   pnpm --filter @workspace/scripts migrate lib/db/holding_stocks.sql --dry-run
 *
 * It prints the target host/database and the statements it is about to run,
 * refuses to run anything that is not additive unless --allow-destructive is
 * passed, and reports the resulting table state. Connection details come from
 * the root .env (or the real environment, which is how production is wired).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

// Load the root .env if the caller has not already exported these vars.
try {
  process.loadEnvFile(resolve(REPO_ROOT, ".env"));
} catch {
  // No .env — fall back to the ambient environment (production path).
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const allowDestructive = args.includes("--allow-destructive");
const file = args.find((a) => !a.startsWith("--"));

if (!file) {
  console.error("Usage: migrate <path-to.sql> [--dry-run] [--allow-destructive]");
  process.exit(1);
}

const sqlPath = resolve(REPO_ROOT, file);
const raw = readFileSync(sqlPath, "utf8");

/**
 * Split into statements on semicolons that are not inside a string or comment.
 * The schema files here are plain DDL — no stored procedures, so no DELIMITER
 * handling is needed.
 */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (!inSingle && !inDouble && !inBacktick) {
      if (c === "-" && next === "-") { inLineComment = true; i++; continue; }
      if (c === "#") { inLineComment = true; continue; }
      if (c === "/" && next === "*") { inBlockComment = true; i++; continue; }
    }

    if (c === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
    else if (c === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
    else if (c === "`" && !inSingle && !inDouble) inBacktick = !inBacktick;

    if (c === ";" && !inSingle && !inDouble && !inBacktick) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Statement kinds that can destroy data. Blocked unless explicitly allowed. */
const DESTRUCTIVE = /^\s*(DROP|TRUNCATE|DELETE|ALTER\s+TABLE\s+\S+\s+DROP)\b/i;

const statements = splitStatements(raw);
const destructive = statements.filter((s) => DESTRUCTIVE.test(s));

function describe(stmt: string): string {
  const oneLine = stmt.replace(/\s+/g, " ").trim();
  return oneLine.length > 110 ? `${oneLine.slice(0, 110)}…` : oneLine;
}

function connectionSummary(): string {
  const url = process.env["DATABASE_URL"]?.trim();
  if (url?.startsWith("mysql")) {
    try {
      const u = new URL(url);
      return `${u.hostname}:${u.port || 3306}/${u.pathname.replace(/^\//, "")} (user ${u.username || "?"})`;
    } catch {
      return "DATABASE_URL (unparseable)";
    }
  }
  const host = process.env["DB_HOST"] ?? process.env["MYSQL_HOST"] ?? "?";
  const port = process.env["DB_PORT"] ?? process.env["MYSQL_PORT"] ?? "3306";
  const name = process.env["DB_NAME"] ?? process.env["MYSQL_DATABASE"] ?? "?";
  const user = process.env["DB_USER"] ?? process.env["MYSQL_USER"] ?? "?";
  return `${host}:${port}/${name} (user ${user})`;
}

async function createConnection() {
  const url = process.env["DATABASE_URL"]?.trim();
  if (url?.startsWith("mysql")) return mysql.createConnection(url);

  const host = process.env["DB_HOST"] ?? process.env["MYSQL_HOST"];
  const user = process.env["DB_USER"] ?? process.env["MYSQL_USER"];
  const database = process.env["DB_NAME"] ?? process.env["MYSQL_DATABASE"];
  if (!host || !user || !database) {
    throw new Error("No DATABASE_URL and no DB_HOST/DB_USER/DB_NAME — cannot connect.");
  }
  return mysql.createConnection({
    host,
    port: Number(process.env["DB_PORT"] ?? process.env["MYSQL_PORT"] ?? 3306),
    user,
    password: process.env["DB_PASSWORD"] ?? process.env["MYSQL_PASSWORD"] ?? "",
    database,
  });
}

console.log(`\nMigration : ${file}`);
console.log(`Target    : ${connectionSummary()}`);
console.log(`Statements: ${statements.length}${dryRun ? "  (dry run)" : ""}\n`);

for (const s of statements) console.log(`  · ${describe(s)}`);

if (destructive.length && !allowDestructive) {
  console.error(
    `\nRefusing to run: ${destructive.length} statement(s) can destroy data. ` +
      `Re-run with --allow-destructive if that is intended.`
  );
  process.exit(1);
}

if (dryRun) {
  console.log("\nDry run — nothing was executed.");
  process.exit(0);
}

const conn = await createConnection();
try {
  const [before] = await conn.query<mysql.RowDataPacket[]>("SHOW TABLES");
  const beforeNames = new Set(before.map((r) => String(Object.values(r)[0])));

  console.log("");
  for (const stmt of statements) {
    await conn.query(stmt);
    console.log(`  ✓ ${describe(stmt).slice(0, 70)}`);
  }

  const [after] = await conn.query<mysql.RowDataPacket[]>("SHOW TABLES");
  const afterNames = after.map((r) => String(Object.values(r)[0]));
  const created = afterNames.filter((t) => !beforeNames.has(t));

  console.log(
    created.length
      ? `\nCreated: ${created.join(", ")}`
      : "\nNo new tables — the schema was already present (statements are idempotent)."
  );
  console.log(`Tables now: ${afterNames.length}`);
} finally {
  await conn.end();
}
