import { mysqlTable, bigint, char, timestamp } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const emailVerificationsTable = mysqlTable("email_verifications", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: char("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EmailVerificationRow = typeof emailVerificationsTable.$inferSelect;
