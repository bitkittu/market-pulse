import { mysqlTable, bigint, varchar, timestamp } from "drizzle-orm/mysql-core";
import { usersTable } from "./users";

export const userProfilesTable = mysqlTable("user_profiles", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  phone: varchar("phone", { length: 20 }),
  bio: varchar("bio", { length: 500 }),
  timezone: varchar("timezone", { length: 50 }).notNull().default("Asia/Kolkata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().onUpdateNow(),
});

export type UserProfileRow = typeof userProfilesTable.$inferSelect;
