import { mysqlTable, int, varchar, timestamp, primaryKey } from "drizzle-orm/mysql-core";
import { rolesTable } from "./roles";

export const permissionsTable = mysqlTable("permissions", {
  id: int("id", { unsigned: true }).autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PermissionRow = typeof permissionsTable.$inferSelect;

export const rolePermissionsTable = mysqlTable("role_permissions", {
  roleId: int("role_id", { unsigned: true }).notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
  permissionId: int("permission_id", { unsigned: true }).notNull().references(() => permissionsTable.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId] }),
]);
