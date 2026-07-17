import { mysqlTable, bigint, varchar, mysqlEnum, timestamp } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const loginHistoryTable = mysqlTable("login_history", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 255 }),
  status: mysqlEnum("status", ["success", "failed"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LoginHistoryRow = typeof loginHistoryTable.$inferSelect;
