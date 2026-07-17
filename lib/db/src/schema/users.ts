import { mysqlTable, bigint, varchar, int, mysqlEnum, timestamp } from "drizzle-orm/mysql-core";
import { rolesTable } from "./roles";

export const usersTable = mysqlTable("users", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 190 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  roleId: int("role_id", { unsigned: true }).notNull().references(() => rolesTable.id),
  plan: mysqlEnum("plan", ["free", "pro", "premium"]).notNull().default("free"),
  status: mysqlEnum("status", ["active", "suspended"]).notNull().default("active"),
  emailVerifiedAt: timestamp("email_verified_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().onUpdateNow(),
});

export type UserRow = typeof usersTable.$inferSelect;
