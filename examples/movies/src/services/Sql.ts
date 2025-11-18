import { Database } from "bun:sqlite"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Path from "@effect/platform/Path"

export class SqlError extends Data.TaggedError("SqlError")<{
  cause: unknown
}> {}

export interface User {
  id: string
  email: string
  passwordHash: string
  name: string
  isBanned: boolean
  isVerified: boolean
  created: string
  updated: string
}

export interface UserSession {
  id: string
  userId: string
  created: string
  expires: string
}

export interface SqlService {
  readonly db: Database
  readonly createUser: (
    user: Omit<User, "created" | "updated">
  ) => Effect.Effect<string, SqlError>
  readonly findUserByEmail: (email: string) => Effect.Effect<User | null, SqlError>
  readonly createSession: (
    userId: string,
    expiresIn: number
  ) => Effect.Effect<string, SqlError>
  readonly findSession: (
    sessionId: string
  ) => Effect.Effect<{ user: User; session: UserSession } | null, SqlError>
  readonly deleteSession: (sessionId: string) => Effect.Effect<void, SqlError>
  readonly updateSessionExpiry: (
    sessionId: string,
    newExpires: string
  ) => Effect.Effect<void, SqlError>
}

export const Sql = Context.GenericTag<SqlService>("Sql")

export const SqlLive = Layer.effect(
  Sql,
  Effect.gen(function*() {
    const path = yield* Path.Path
    const dataDir = path.join(import.meta.dir, "../../data")
    const dbPath = path.join(dataDir, "movies.db")

    const db = new Database(dbPath, { create: true })

    db.run(`
      CREATE TABLE IF NOT EXISTS User (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        name TEXT NOT NULL,
        isBanned INTEGER NOT NULL DEFAULT 0,
        isVerified INTEGER NOT NULL DEFAULT 0,
        created TEXT NOT NULL DEFAULT (datetime('now')),
        updated TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.run(`
      CREATE TABLE IF NOT EXISTS UserSession (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        created TEXT NOT NULL DEFAULT (datetime('now')),
        expires TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
      )
    `)

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_user_session_userId ON UserSession(userId)
    `)

    const createUser = (user: Omit<User, "created" | "updated">) =>
      Effect.try({
        try: () => {
          db.run(
            `INSERT INTO User (id, email, passwordHash, name, isBanned, isVerified)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              user.id,
              user.email,
              user.passwordHash,
              user.name,
              user.isBanned ? 1 : 0,
              user.isVerified ? 1 : 0,
            ],
          )
          return user.id
        },
        catch: (error) => new SqlError({ cause: error }),
      })

    const findUserByEmail = (email: string) =>
      Effect.try({
        try: () => {
          const row = db.query(`SELECT * FROM User WHERE email = ?`).get(email)
          if (!row) return null
          return row as User
        },
        catch: (error) => new SqlError({ cause: error }),
      })

    const createSession = (userId: string, expiresIn: number) =>
      Effect.gen(function*() {
        const sessionId = crypto.randomUUID()
        const expires = new Date(Date.now() + expiresIn).toISOString()

        yield* Effect.try({
          try: () => {
            db.run(
              `INSERT INTO UserSession (id, userId, expires) VALUES (?, ?, ?)`,
              [sessionId, userId, expires],
            )
            return sessionId
          },
          catch: (error) => new SqlError({ cause: error }),
        })

        return sessionId
      })

    const findSession = (sessionId: string) =>
      Effect.try({
        try: () => {
          const row = db.query(`
            SELECT
              u.id as user_id,
              u.email as user_email,
              u.passwordHash as user_passwordHash,
              u.name as user_name,
              u.isBanned as user_isBanned,
              u.isVerified as user_isVerified,
              u.created as user_created,
              u.updated as user_updated,
              s.id as session_id,
              s.userId as session_userId,
              s.created as session_created,
              s.expires as session_expires
            FROM UserSession s
            INNER JOIN User u ON u.id = s.userId
            WHERE s.id = ?
          `).get(sessionId)

          if (!row) return null

          const result: any = row
          return {
            user: {
              id: result.user_id,
              email: result.user_email,
              passwordHash: result.user_passwordHash,
              name: result.user_name,
              isBanned: Boolean(result.user_isBanned),
              isVerified: Boolean(result.user_isVerified),
              created: result.user_created,
              updated: result.user_updated,
            },
            session: {
              id: result.session_id,
              userId: result.session_userId,
              created: result.session_created,
              expires: result.session_expires,
            },
          }
        },
        catch: (error) => new SqlError({ cause: error }),
      })

    const deleteSession = (sessionId: string) =>
      Effect.try({
        try: () => {
          db.run(`DELETE FROM UserSession WHERE id = ?`, [sessionId])
        },
        catch: (error) => new SqlError({ cause: error }),
      })

    const updateSessionExpiry = (sessionId: string, newExpires: string) =>
      Effect.try({
        try: () => {
          db.run(
            `UPDATE UserSession SET expires = ? WHERE id = ?`,
            [newExpires, sessionId],
          )
        },
        catch: (error) => new SqlError({ cause: error }),
      })

    return {
      db,
      createUser,
      findUserByEmail,
      createSession,
      findSession,
      deleteSession,
      updateSessionExpiry,
    }
  }),
)
