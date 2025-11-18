import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as Schema from "./Schema.ts"

export class DrizzleError extends Data.TaggedError("DrizzleError")<{
  readonly cause: unknown
}> {}

export class Sql extends Effect.Service<Sql>()("Sql", {
  effect: Effect.gen(function*() {
    const dbPath = "./examples/movies/data/movies.db"

    const sqlite = new Database(dbPath)
    const driver = drizzle(sqlite, { schema: Schema.schema })

    yield* Effect.sync(() => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS User (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          passwordHash TEXT NOT NULL,
          name TEXT NOT NULL,
          isBanned INTEGER NOT NULL DEFAULT 0,
          isVerified INTEGER NOT NULL DEFAULT 0,
          created INTEGER,
          updated INTEGER
        )
      `)

      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS UserSession (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
          created INTEGER,
          expires INTEGER
        )
      `)

      sqlite.exec(`
        CREATE INDEX IF NOT EXISTS UserSession_userId_idx ON UserSession(userId)
      `)
    })

    return {
      driver,
      use<T>(perform: (db: typeof driver, schema: typeof Schema.schema) => T | Promise<T>) {
        return Effect.tryPromise({
          try: () => Promise.resolve(perform(driver, Schema.schema)),
          catch: (error) => new DrizzleError({ cause: error }),
        })
      },
    } as const
  }),
  dependencies: [],
}) {}
