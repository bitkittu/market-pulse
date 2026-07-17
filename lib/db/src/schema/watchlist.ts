import { mysqlTable, bigint, varchar, timestamp, unique } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const watchlistTable = mysqlTable("watchlist", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  symbol: varchar("symbol", { length: 30 }).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_watchlist_user_symbol").on(table.userId, table.symbol),
]);

export const insertWatchlistSchema = createInsertSchema(watchlistTable).omit({ id: true, addedAt: true });
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type WatchlistEntry = typeof watchlistTable.$inferSelect;
