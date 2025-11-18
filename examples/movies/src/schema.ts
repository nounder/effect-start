import { index, sqliteTable, text } from "drizzle-orm/sqlite-core"
import * as Crypto from "effect/Crypto"
import * as Effect from "effect/Effect"

export const primaryId = () => text("id").primaryKey().$defaultFn(() => Crypto.randomUUID())

export const id = () => text("id")

export const timestamp = () =>
  text("timestamp", { mode: "text" })
    .$type<Date>()
    .$defaultFn(() => new Date())

export const boolean = () => text("boolean", { mode: "text" }).$type<boolean>()

export const User = sqliteTable("User", {
  id: primaryId(),
  email: text("email").unique().notNull(),
  passwordHash: text("passwordHash").notNull(),
  name: text("name").notNull(),
  pfpId: id(),
  isBanned: boolean().notNull().default(false),
  isVerified: boolean().notNull().default(false),
  created: timestamp(),
  updated: timestamp(),
})

export const UserSession = sqliteTable("UserSession", {
  id: primaryId(),
  userId: id()
    .references(() => User.id, { onDelete: "cascade" })
    .notNull(),
  created: timestamp(),
  expires: timestamp(),
}, (t) => [
  index("UserSession_userId_idx").on(t.userId),
])
