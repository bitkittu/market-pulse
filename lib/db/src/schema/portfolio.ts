import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portfolioTable = pgTable("portfolio", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  exchange: text("exchange").notNull().default("NSE"),
  buyPrice: real("buy_price"),
  quantity: integer("quantity"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const insertPortfolioSchema = createInsertSchema(portfolioTable).omit({ id: true, addedAt: true });
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type PortfolioEntry = typeof portfolioTable.$inferSelect;
