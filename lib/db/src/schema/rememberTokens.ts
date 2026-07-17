import { mysqlTable, bigint, char, timestamp } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const rememberTokensTable = mysqlTable("remember_tokens", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  selector: char("selector", { length: 24 }).notNull().unique(),
  validatorHash: char("validator_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RememberTokenRow = typeof rememberTokensTable.$inferSelect;
