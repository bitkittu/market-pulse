import { mysqlTable, bigint, varchar, decimal, int, timestamp, unique } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const portfolioTable = mysqlTable("portfolio", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  symbol: varchar("symbol", { length: 30 }).notNull(),
  exchange: varchar("exchange", { length: 10 }).notNull().default("NSE"),
  buyPrice: decimal("buy_price", { precision: 14, scale: 4, mode: "number" }),
  quantity: int("quantity"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_portfolio_user_symbol").on(table.userId, table.symbol),
]);

export const insertPortfolioSchema = createInsertSchema(portfolioTable).omit({ id: true, addedAt: true });
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type PortfolioEntry = typeof portfolioTable.$inferSelect;
