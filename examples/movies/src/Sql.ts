import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as schema from "./schema.ts"

export class DrizzleError extends Data.TaggedError("DrizzleError")<{
  cause: unknown
}> {}

export class Sql extends Effect.Service<Sql>()("Sql", {
  effect: Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const dataDir = yield* path.join("data")
    const dbPath = yield* path.join(dataDir, "movies.db")

    yield* Effect.tryPromise({
      try: () => fs.exists(dataDir),
      catch: (error) => new DrizzleError({ cause: error }),
    }).pipe(
      Effect.flatMap((exists) =>
        exists
          ? Effect.void
          : Effect.tryPromise({
            try: () => fs.makeDirectory(dataDir, { recursive: true }),
            catch: (error) => new DrizzleError({ cause: error }),
          })
      ),
    )

    const sqlite = new Database(dbPath)
    const driver = drizzle({ client: sqlite, schema })

    sqlite.run(`
      CREATE TABLE IF NOT EXISTS User (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        name TEXT NOT NULL,
        pfpId TEXT,
        isBanned TEXT NOT NULL DEFAULT 'false',
        isVerified TEXT NOT NULL DEFAULT 'false',
        created TEXT,
        updated TEXT
      )
    `)

    sqlite.run(`
      CREATE TABLE IF NOT EXISTS UserSession (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        created TEXT,
        expires TEXT,
        FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
      )
    `)

    sqlite.run(`
      CREATE INDEX IF NOT EXISTS UserSession_userId_idx ON UserSession(userId)
    `)

    return {
      driver,
      use<T>(perform: (db: typeof driver, schema: typeof schema) => T | Promise<T>) {
        return Effect.tryPromise({
          try: () => Promise.resolve(perform(driver, schema)),
          catch: (error) => new DrizzleError({ cause: error }),
        })
      },
    }
  }),
}) {}
