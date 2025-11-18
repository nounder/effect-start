import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

const id = () => text().primaryKey().$default(() => crypto.randomUUID())

const timestamp = () =>
  integer({ mode: "timestamp" }).$default(() => new Date())

export const User = sqliteTable("User", {
  id: id(),
  email: text().unique().notNull(),
  passwordHash: text().notNull(),
  name: text().notNull(),
  isBanned: integer({ mode: "boolean" }).notNull().default(false),
  isVerified: integer({ mode: "boolean" }).notNull().default(false),
  created: timestamp(),
  updated: timestamp(),
})

export const UserSession = sqliteTable("UserSession", {
  id: id(),
  userId: text().notNull().references(() => User.id, { onDelete: "cascade" }),
  created: timestamp(),
  expires: integer({ mode: "timestamp" }),
}, (t) => [
  index("UserSession_userId_idx").on(t.userId),
])

export const schema = {
  User,
  UserSession,
}
