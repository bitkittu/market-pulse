import { mysqlTable, bigint, varchar, boolean, timestamp } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const upstoxSettingsTable = mysqlTable("upstox_settings", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  apiKey: varchar("api_key", { length: 255 }).notNull(),
  apiSecret: varchar("api_secret", { length: 255 }),
  clientId: varchar("client_id", { length: 100 }),
  accessToken: varchar("access_token", { length: 500 }),
  liveDataEnabled: boolean("live_data_enabled").notNull().default(true),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
});

export type UpstoxSettings = typeof upstoxSettingsTable.$inferSelect;
