import { mysqlTable, bigint, char, timestamp } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const passwordResetsTable = mysqlTable("password_resets", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: char("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PasswordResetRow = typeof passwordResetsTable.$inferSelect;
