import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SqlClient, SqlIntrospect } from "effect-start/sql"
import * as BunSql from "../src/sql/bun/index.ts"

const runSql = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
  Effect.runPromise(
    Effect.provide(effect, BunSql.layer({ adapter: "sqlite", filename: ":memory:" })),
  )

const setupTestDb = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    age INTEGER DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT 1
  )`
  yield* sql`CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT,
    score REAL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
  )`
  yield* sql`CREATE INDEX idx_posts_user_id ON posts(user_id)`
  yield* sql`CREATE UNIQUE INDEX idx_users_email ON users(email)`

  yield* sql`INSERT INTO users (name, email, age, active) VALUES (${"Alice"}, ${"alice@test.com"}, ${30}, ${1})`
  yield* sql`INSERT INTO users (name, email, age, active) VALUES (${"Bob"}, ${"bob@test.com"}, ${25}, ${1})`
  yield* sql`INSERT INTO users (name, email, age, active) VALUES (${"Charlie"}, ${null}, ${35}, ${0})`
  yield* sql`INSERT INTO posts (title, body, score, user_id) VALUES (${"Hello"}, ${"World"}, ${4.5}, ${1})`
  yield* sql`INSERT INTO posts (title, body, score, user_id) VALUES (${"Goodbye"}, ${null}, ${null}, ${2})`
})

test.describe("SqlIntrospect", () => {
  test.describe("introspect", () => {
    test.it("should introspect tables and columns", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const schema = yield* SqlIntrospect.introspect("sqlite")

          test.expect(schema.tables).toHaveLength(2)

          const users = schema.tables.find((t) => t.tableName === "users")!
          const posts = schema.tables.find((t) => t.tableName === "posts")!

          test.expect(users.columns).toHaveLength(5)
          test.expect(users.columns[0].columnName).toBe("id")
          test.expect(users.columns[0].isPrimaryKey).toBe(true)
          test.expect(users.columns[0].isAutoIncrement).toBe(true)
          test.expect(users.columns[1].columnName).toBe("name")
          test.expect(users.columns[1].isNullable).toBe(false)
          test.expect(users.columns[2].columnName).toBe("email")
          test.expect(users.columns[2].isNullable).toBe(true)
          test.expect(users.columns[3].columnDefault).toBe("0")

          test.expect(posts.columns).toHaveLength(5)
          test.expect(posts.foreignKeys).toHaveLength(1)
          test.expect(posts.foreignKeys[0].referencedTable).toBe("users")
          test.expect(posts.foreignKeys[0].referencedColumn).toBe("id")
          test.expect(posts.foreignKeys[0].columnName).toBe("user_id")
          test.expect(posts.foreignKeys[0].deleteRule).toBe("CASCADE")

          test.expect(posts.indexes).toHaveLength(1)
          test.expect(posts.indexes[0].indexName).toBe("idx_posts_user_id")
          test.expect(posts.indexes[0].isUnique).toBe(false)

          test.expect(users.indexes).toHaveLength(1)
          test.expect(users.indexes[0].indexName).toBe("idx_users_email")
          test.expect(users.indexes[0].isUnique).toBe(true)
        }),
      ),
    )

    test.it("should skip foreign keys when disabled", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const schema = yield* SqlIntrospect.introspect("sqlite", { foreignKeys: false })
          const posts = schema.tables.find((t) => t.tableName === "posts")!

          test.expect(posts.foreignKeys).toHaveLength(0)
          test.expect(posts.indexes).toHaveLength(1)
        }),
      ),
    )

    test.it("should skip indexes when disabled", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const schema = yield* SqlIntrospect.introspect("sqlite", { indexes: false })
          const posts = schema.tables.find((t) => t.tableName === "posts")!

          test.expect(posts.foreignKeys).toHaveLength(1)
          test.expect(posts.indexes).toHaveLength(0)
        }),
      ),
    )

    test.it("should skip both when disabled", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const schema = yield* SqlIntrospect.introspect("sqlite", {
            foreignKeys: false,
            indexes: false,
          })
          const posts = schema.tables.find((t) => t.tableName === "posts")!

          test.expect(posts.foreignKeys).toHaveLength(0)
          test.expect(posts.indexes).toHaveLength(0)
          test.expect(posts.columns).toHaveLength(5)
        }),
      ),
    )

    test.it("should return empty schema for empty database", () =>
      runSql(
        Effect.gen(function* () {
          const schema = yield* SqlIntrospect.introspect("sqlite")

          test.expect(schema.tables).toHaveLength(0)
        }),
      ),
    )
  })

  test.describe("isSortable", () => {
    test.it("primary key columns should be sortable", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const users = db.tables.find((t) => t.tableName === "users")!
          const id = users.columns.find((c) => c.columnName === "id")!

          test.expect(id.isSortable).toBe(true)
        }),
      ),
    )

    test.it("single-column indexed columns should be sortable", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const users = db.tables.find((t) => t.tableName === "users")!
          const email = users.columns.find((c) => c.columnName === "email")!

          test.expect(email.isSortable).toBe(true)

          const posts = db.tables.find((t) => t.tableName === "posts")!
          const userId = posts.columns.find((c) => c.columnName === "user_id")!

          test.expect(userId.isSortable).toBe(true)
        }),
      ),
    )

    test.it("unindexed columns should not be sortable", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const users = db.tables.find((t) => t.tableName === "users")!
          const name = users.columns.find((c) => c.columnName === "name")!

          test.expect(name.isSortable).toBe(false)

          const age = users.columns.find((c) => c.columnName === "age")!

          test.expect(age.isSortable).toBe(false)
        }),
      ),
    )

    test.it("composite index columns should not be sortable individually", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`CREATE TABLE composite (id INTEGER PRIMARY KEY, a TEXT, b TEXT)`
          yield* sql`CREATE INDEX idx_composite_ab ON composite(a, b)`
          const db = yield* SqlIntrospect.introspect("sqlite")
          const table = db.tables.find((t) => t.tableName === "composite")!
          const a = table.columns.find((c) => c.columnName === "a")!
          const b = table.columns.find((c) => c.columnName === "b")!

          test.expect(a.isSortable).toBe(false)
          test.expect(b.isSortable).toBe(false)
        }),
      ),
    )

    test.it("without indexes introspected, only primary keys are sortable", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite", { indexes: false })
          const users = db.tables.find((t) => t.tableName === "users")!
          const id = users.columns.find((c) => c.columnName === "id")!

          test.expect(id.isSortable).toBe(true)

          const email = users.columns.find((c) => c.columnName === "email")!

          test.expect(email.isSortable).toBe(false)
        }),
      ),
    )
  })

  test.describe("tableToSchema", () => {
    test.it("should map columns to Schema.Struct fields", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const users = db.tables.find((t) => t.tableName === "users")!
          const ts = SqlIntrospect.tableToSchema(users)!

          test.expect(ts.tableName).toBe("users")
          test.expect(ts.columns).toHaveLength(5)

          const decoded = Schema.decodeUnknownSync(ts.schema)({
            id: 1,
            name: "Alice",
            email: null,
            age: 30,
            active: true,
          })

          test.expect(decoded).toEqual({
            id: 1,
            name: "Alice",
            email: null,
            age: 30,
            active: true,
          })
        }),
      ),
    )

    test.it("should handle nullable columns with NullOr", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const posts = db.tables.find((t) => t.tableName === "posts")!
          const ts = SqlIntrospect.tableToSchema(posts)!

          const decoded = Schema.decodeUnknownSync(ts.schema)({
            id: 1,
            title: "Hello",
            body: null,
            score: null,
            user_id: 1,
          })

          test.expect(decoded.body).toBeNull()
          test.expect(decoded.score).toBeNull()
        }),
      ),
    )

    test.it("should skip unmappable columns (blob)", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`CREATE TABLE blobs (id INTEGER PRIMARY KEY, data BLOB, name TEXT)`
          const db = yield* SqlIntrospect.introspect("sqlite")
          const table = db.tables.find((t) => t.tableName === "blobs")!
          const ts = SqlIntrospect.tableToSchema(table)!

          test.expect(ts.columns).toHaveLength(2)
          test.expect(ts.columns.map((c) => c.columnName)).toEqual(["id", "name"])
        }),
      ),
    )

    test.it("should return null for table with only unmappable columns", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`CREATE TABLE only_blobs (data BLOB, image BLOB)`
          const db = yield* SqlIntrospect.introspect("sqlite")
          const table = db.tables.find((t) => t.tableName === "only_blobs")!
          const ts = SqlIntrospect.tableToSchema(table)

          test.expect(ts).toBeNull()
        }),
      ),
    )
  })

  test.describe("toSchemas", () => {
    test.it("should convert all tables to schemas, skipping unmappable", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`CREATE TABLE mappable (id INTEGER PRIMARY KEY, name TEXT)`
          yield* sql`CREATE TABLE unmappable (data BLOB)`
          const db = yield* SqlIntrospect.introspect("sqlite")
          const schemas = SqlIntrospect.toSchemas(db)

          test.expect(schemas).toHaveLength(1)
          test.expect(schemas[0].tableName).toBe("mappable")
        }),
      ),
    )
  })

  test.describe("DatabaseReader", () => {
    test.it("findAll should return all rows", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)
          const users = reader.table("users")!
          const rows = yield* users.findAll()

          test.expect(rows).toHaveLength(3)
        }),
      ),
    )

    test.it("findAll should support limit and offset", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)
          const users = reader.table("users")!
          const rows = yield* users.findAll({
            limit: 1,
            offset: 1,
            sort: [{ column: "id" }],
          })

          test.expect(rows).toHaveLength(1)
          test.expect((rows[0] as any).name).toBe("Bob")
        }),
      ),
    )

    test.it("sortableColumns should list sortable column names", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)
          const users = reader.table("users")!

          test.expect([...users.sortableColumns].sort()).toEqual(["email", "id"])

          const posts = reader.table("posts")!

          test.expect([...posts.sortableColumns].sort()).toEqual(["id", "user_id"])
        }),
      ),
    )

    test.it("findAll should sort ascending by default", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)
          const users = reader.table("users")!
          const rows = yield* users.findAll({
            sort: [{ column: "id" }],
          })

          test.expect((rows[0] as any).id).toBe(1)
          test.expect((rows[2] as any).id).toBe(3)
        }),
      ),
    )

    test.it("findAll should sort descending with reverse", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)
          const users = reader.table("users")!
          const rows = yield* users.findAll({
            sort: [{ column: "id", reverse: true }],
          })

          test.expect((rows[0] as any).id).toBe(3)
          test.expect((rows[2] as any).id).toBe(1)
        }),
      ),
    )

    test.it("findAll should ignore sort on non-sortable columns", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)
          const users = reader.table("users")!
          const rows = yield* users.findAll({
            sort: [{ column: "name", reverse: true }],
          })

          test.expect(rows).toHaveLength(3)
        }),
      ),
    )

    test.it("findAll should support multiple sort columns", () =>
      runSql(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient
          yield* sql`CREATE TABLE items (id INTEGER PRIMARY KEY, category INTEGER, name TEXT)`
          yield* sql`CREATE INDEX idx_items_category ON items(category)`
          yield* sql`INSERT INTO items (category, name) VALUES (${2}, ${"B"})`
          yield* sql`INSERT INTO items (category, name) VALUES (${1}, ${"A"})`
          yield* sql`INSERT INTO items (category, name) VALUES (${2}, ${"C"})`
          yield* sql`INSERT INTO items (category, name) VALUES (${1}, ${"D"})`

          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)
          const items = reader.table("items")!
          const rows = yield* items.findAll({
            sort: [{ column: "category" }, { column: "id", reverse: true }],
          })

          test.expect((rows[0] as any).category).toBe(1)
          test.expect((rows[0] as any).name).toBe("D")
          test.expect((rows[1] as any).category).toBe(1)
          test.expect((rows[1] as any).name).toBe("A")
          test.expect((rows[2] as any).category).toBe(2)
        }),
      ),
    )

    test.describe("filters", () => {
      test.it("findAll should filter with eq", () =>
        runSql(
          Effect.gen(function* () {
            yield* setupTestDb
            const db = yield* SqlIntrospect.introspect("sqlite")
            const reader = SqlIntrospect.makeDatabaseReader(db)
            const users = reader.table("users")!
            const rows = yield* users.findAll({
              filters: [{ column: "name", op: "eq", value: "Alice" }],
            })

            test.expect(rows).toHaveLength(1)
            test.expect((rows[0] as any).name).toBe("Alice")
          }),
        ),
      )

      test.it("findAll should filter with neq", () =>
        runSql(
          Effect.gen(function* () {
            yield* setupTestDb
            const db = yield* SqlIntrospect.introspect("sqlite")
            const reader = SqlIntrospect.makeDatabaseReader(db)
            const users = reader.table("users")!
            const rows = yield* users.findAll({
              filters: [{ column: "name", op: "neq", value: "Alice" }],
            })

            test.expect(rows).toHaveLength(2)
            test.expect((rows as Array<any>).every((r) => r.name !== "Alice")).toBe(true)
          }),
        ),
      )

      test.it("findAll should filter null with eq (IS NULL)", () =>
        runSql(
          Effect.gen(function* () {
            yield* setupTestDb
            const db = yield* SqlIntrospect.introspect("sqlite")
            const reader = SqlIntrospect.makeDatabaseReader(db)
            const users = reader.table("users")!
            const rows = yield* users.findAll({
              filters: [{ column: "email", op: "eq", value: null }],
            })

            test.expect(rows).toHaveLength(1)
            test.expect((rows[0] as any).name).toBe("Charlie")
          }),
        ),
      )

      test.it("findAll should filter null with neq (IS NOT NULL)", () =>
        runSql(
          Effect.gen(function* () {
            yield* setupTestDb
            const db = yield* SqlIntrospect.introspect("sqlite")
            const reader = SqlIntrospect.makeDatabaseReader(db)
            const users = reader.table("users")!
            const rows = yield* users.findAll({
              filters: [{ column: "email", op: "neq", value: null }],
            })

            test.expect(rows).toHaveLength(2)
          }),
        ),
      )

      test.it("findAll should support multiple filters (AND)", () =>
        runSql(
          Effect.gen(function* () {
            yield* setupTestDb
            const db = yield* SqlIntrospect.introspect("sqlite")
            const reader = SqlIntrospect.makeDatabaseReader(db)
            const users = reader.table("users")!
            const rows = yield* users.findAll({
              filters: [
                { column: "active", op: "eq", value: 1 },
                { column: "name", op: "neq", value: "Alice" },
              ],
            })

            test.expect(rows).toHaveLength(1)
            test.expect((rows[0] as any).name).toBe("Bob")
          }),
        ),
      )

      test.it("findAll should ignore filters on unknown columns", () =>
        runSql(
          Effect.gen(function* () {
            yield* setupTestDb
            const db = yield* SqlIntrospect.introspect("sqlite")
            const reader = SqlIntrospect.makeDatabaseReader(db)
            const users = reader.table("users")!
            const rows = yield* users.findAll({
              filters: [{ column: "nonexistent", op: "eq", value: "x" }],
            })

            test.expect(rows).toHaveLength(3)
          }),
        ),
      )

      test.it("findAll should combine filters with sort and pagination", () =>
        runSql(
          Effect.gen(function* () {
            yield* setupTestDb
            const db = yield* SqlIntrospect.introspect("sqlite")
            const reader = SqlIntrospect.makeDatabaseReader(db)
            const users = reader.table("users")!
            const rows = yield* users.findAll({
              filters: [{ column: "active", op: "eq", value: 1 }],
              sort: [{ column: "id", reverse: true }],
              limit: 1,
            })

            test.expect(rows).toHaveLength(1)
            test.expect((rows[0] as any).name).toBe("Bob")
          }),
        ),
      )

      test.it("count should support filters", () =>
        runSql(
          Effect.gen(function* () {
            yield* setupTestDb
            const db = yield* SqlIntrospect.introspect("sqlite")
            const reader = SqlIntrospect.makeDatabaseReader(db)
            const users = reader.table("users")!
            const total = yield* users.count()

            test.expect(total).toBe(3)

            const active = yield* users.count({
              filters: [{ column: "active", op: "eq", value: 1 }],
            })

            test.expect(active).toBe(2)
          }),
        ),
      )
    })

    test.it("findById should return single row", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)
          const users = reader.table("users")!
          const user = (yield* users.findById(2)) as any

          test.expect(user.name).toBe("Bob")
        }),
      ),
    )

    test.it("findById should return null for missing row", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)
          const users = reader.table("users")!
          const user = yield* users.findById(999)

          test.expect(user).toBeNull()
        }),
      ),
    )

    test.it("table should return undefined for unknown table", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)

          test.expect(reader.table("nonexistent")).toBeUndefined()
        }),
      ),
    )

    test.it("should list all table readers", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)

          test.expect(reader.tables).toHaveLength(2)
          test.expect(reader.tables.map((t) => t.tableName).sort()).toEqual(["posts", "users"])
        }),
      ),
    )

    test.it("reader schema should validate rows", () =>
      runSql(
        Effect.gen(function* () {
          yield* setupTestDb
          const db = yield* SqlIntrospect.introspect("sqlite")
          const reader = SqlIntrospect.makeDatabaseReader(db)
          const users = reader.table("users")!
          const rows = yield* users.findAll()
          for (const row of rows) {
            const result = Schema.decodeUnknownEither(users.schema)(row)

            test.expect(result._tag).toBe("Right")
          }
        }),
      ),
    )
  })
})
