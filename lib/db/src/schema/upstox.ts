import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const upstoxSettingsTable = pgTable("upstox_settings", {
  id: serial("id").primaryKey(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret"),
  clientId: text("client_id"),
  accessToken: text("access_token"),
  liveDataEnabled: boolean("live_data_enabled").notNull().default(true),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
});

export type UpstoxSettings = typeof upstoxSettingsTable.$inferSelect;
