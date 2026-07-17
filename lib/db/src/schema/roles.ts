import { mysqlTable, int, varchar, timestamp } from "drizzle-orm/mysql-core";

export const rolesTable = mysqlTable("roles", {
  id: int("id", { unsigned: true }).autoincrement().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RoleRow = typeof rolesTable.$inferSelect;
