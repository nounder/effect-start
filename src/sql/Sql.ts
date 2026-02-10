import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effectable from "effect/Effectable"
import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import { isTemplateStringsArray } from "../Values.ts"

export class SqlError extends Data.TaggedError("SqlError")<{
  readonly code: string
  readonly message: string
  readonly cause?: unknown
}> {}

export const SqlFragmentTag: unique symbol = Symbol.for("effect-start/Sql/SqlFragment") as any

export type SqlFragment =
  | { readonly [SqlFragmentTag]: "Identifier"; readonly name: string }
  | {
      readonly [SqlFragmentTag]: "Values"
      readonly value: ReadonlyArray<Record<string, unknown>>
      readonly columns: ReadonlyArray<string>
    }
  | { readonly [SqlFragmentTag]: "List"; readonly items: ReadonlyArray<unknown> }
  | { readonly [SqlFragmentTag]: "Literal"; readonly sql: string }

export const SqlFragment = {
  // sql`SELECT * FROM ${sql.identifier("users")}`
  identifier: (name: string): SqlFragment => ({ [SqlFragmentTag]: "Identifier", name }),

  // sql`INSERT INTO users ${sql.values({ name: "Alice", age: 25 })}`
  //  -> INSERT INTO users ("name", "age") VALUES ($1, $2)
  // sql`INSERT INTO users ${sql.values(user, "name")}`
  //  -> INSERT INTO users ("name") VALUES ($1)
  // sql`INSERT INTO users ${sql.values([user1, user2])}`
  //  -> INSERT INTO users ("name", "age") VALUES ($1, $2), ($3, $4)
  values: <T extends Record<string, unknown>>(
    obj: T | ReadonlyArray<T>,
    ...columns: Array<keyof T & string>
  ): SqlFragment => {
    const items = Array.isArray(obj) ? obj : [obj]
    const cols = columns.length > 0 ? columns : (Object.keys(items[0]) as Array<string>)
    return { [SqlFragmentTag]: "Values", value: items, columns: cols }
  },

  // sql`SELECT * FROM users WHERE id IN ${sql.list([1, 2, 3])}`
  list: (items: ReadonlyArray<unknown>): SqlFragment => ({ [SqlFragmentTag]: "List", items }),

  // sql`SELECT * FROM users ${sql.literal("ORDER BY id DESC")}`
  literal: (sql: string): SqlFragment => ({ [SqlFragmentTag]: "Literal", sql }),
} as const

const sqlFragment = (value: unknown): SqlFragment | undefined =>
  value !== null && typeof value === "object" && SqlFragmentTag in value ? value as SqlFragment : undefined

export interface SqlStatement<T> extends Effect.Effect<ReadonlyArray<T>, SqlError> {
  readonly values: () => Effect.Effect<ReadonlyArray<ReadonlyArray<unknown>>, SqlError>
}

const SqlStatementProto = {
  ...Effectable.CommitPrototype,
  commit(this: any) {
    return Effect.suspend(() => this.effect)
  },
  values(this: any) {
    return Effect.suspend(() => this._values())
  },
}

export const makeSqlStatement = <T>(
  effect: Effect.Effect<ReadonlyArray<T>, SqlError>,
  options?: {
    readonly values?: () => Effect.Effect<ReadonlyArray<ReadonlyArray<unknown>>, SqlError>
  },
): SqlStatement<T> => {
  return Object.assign(Object.create(SqlStatementProto), {
    effect,
    _values: options?.values ?? (() => Effect.fail(new SqlError({ code: "NOT_SUPPORTED", message: "values() not supported" }))),
  })
}

export interface DialectConfig {
  readonly placeholder: (index: number) => string
  readonly identifier: (name: string) => string
}

export const compileQuery = (
  dialect: DialectConfig,
  strings: TemplateStringsArray,
  interpolations: Array<unknown>,
): { readonly sql: string; readonly values: Array<unknown> } => {
  const parts: Array<string> = []
  const values: Array<unknown> = []
  let pi = 1

  const pushItems = (items: ReadonlyArray<unknown>) => {
    const ph: Array<string> = []
    for (const item of items) { ph.push(dialect.placeholder(pi++)); values.push(item) }
    return ph.join(", ")
  }

  parts.push(strings[0])
  for (let i = 0; i < interpolations.length; i++) {
    const frag = sqlFragment(interpolations[i])
    if (frag) {
      const tag = frag[SqlFragmentTag]
      if (tag === "Identifier") parts.push(dialect.identifier(frag.name))
      else if (tag === "Literal") parts.push(frag.sql)
      else if (tag === "List") parts.push(`(${pushItems(frag.items)})`)
      else if (tag === "Values") {
        const cols = frag.columns.map((c) => dialect.identifier(c as string)).join(", ")
        const rows = frag.value.map((row) => `(${pushItems(frag.columns.map((c) => row[c as string]))})`).join(", ")
        parts.push(`(${cols}) VALUES ${rows}`)
      }
    } else {
      parts.push(dialect.placeholder(pi++))
      values.push(interpolations[i])
    }
    parts.push(strings[i + 1])
  }
  return { sql: parts.join(""), values }
}

const hasFragments = (values: Array<unknown>): boolean => values.some((v) => sqlFragment(v) !== undefined)

export interface SqlQuery {
  <T = any>(strings: TemplateStringsArray, ...values: Array<unknown>): SqlStatement<T>
  (name: string): SqlFragment
  <T extends Record<string, unknown>>(obj: T | ReadonlyArray<T>): SqlFragment
  <T extends Record<string, unknown>, K extends keyof T>(
    obj: T | ReadonlyArray<T>,
    ...columns: [K, ...Array<K>]
  ): SqlFragment
  (values: ReadonlyArray<string | number | boolean | null>): SqlFragment

  readonly unsafe: <T = any>(
    query: string,
    values?: Array<unknown>,
  ) => Effect.Effect<ReadonlyArray<T>, SqlError>
}

export interface Service extends SqlQuery {
  readonly withTransaction: <A, E, R>(
    self: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, SqlError | E, R>

  readonly reserve: Effect.Effect<SqlQuery, SqlError, Scope.Scope>

  readonly close: (options?: { readonly timeout?: number }) => Effect.Effect<void, SqlError>

  readonly use: <T>(fn: (driver: any) => Promise<T> | T) => Effect.Effect<T, SqlError>

  readonly file: <T = any>(
    filename: string,
    values?: Array<unknown>,
  ) => Effect.Effect<ReadonlyArray<T>, SqlError>
}

export class SqlClient extends Context.Tag("effect-start/Sql/SqlClient")<SqlClient, Service>() {}

const makeFile =
  (unsafe: SqlQuery["unsafe"]) =>
  <T = any>(filename: string, values?: Array<unknown>): Effect.Effect<ReadonlyArray<T>, SqlError> =>
    Effect.flatMap(
      Effect.tryPromise({
        try: () => Bun.file(filename).text(),
        catch: (error) =>
          new SqlError({
            code: "FILE_READ_ERROR",
            message: error instanceof Error ? error.message : String(error),
            cause: error,
          }),
      }),
      (text) => unsafe<T>(text, values),
    )

export type ServiceConfig = Omit<Service, "file" | keyof SqlQuery> & {
  readonly unsafe: SqlQuery["unsafe"]
  readonly file?: Service["file"]
}

export const of = (
  taggedTemplate: (strings: TemplateStringsArray, ...values: Array<unknown>) => SqlStatement<any>,
  config: ServiceConfig,
): Service => {
  const callable = dispatchCallable(taggedTemplate)
  const file = config.file ?? makeFile(config.unsafe)
  return Object.assign(callable, {
    unsafe: config.unsafe,
    withTransaction: config.withTransaction,
    reserve: config.reserve,
    close: config.close,
    use: config.use,
    file,
  }) as unknown as Service
}

export const dispatchCallable = (
  taggedTemplate: (strings: TemplateStringsArray, ...values: Array<unknown>) => any,
): ((first: any, ...rest: Array<any>) => any) => {
  return (first: any, ...rest: Array<any>): any => {
    if (isTemplateStringsArray(first)) {
      return taggedTemplate(first, ...rest)
    }
    if (typeof first === "string") {
      return SqlFragment.identifier(first)
    }
    if (
      Array.isArray(first) &&
      (first.length === 0 || typeof first[0] !== "object" || first[0] === null)
    ) {
      return SqlFragment.list(first)
    }
    return SqlFragment.values(first, ...rest)
  }
}

export const postgresDialect: DialectConfig = {
  placeholder: (i) => `$${i}`,
  identifier: (name) => `"${name.replace(/"/g, '""')}"`,
}

export const sqliteDialect: DialectConfig = {
  placeholder: () => "?",
  identifier: (name) => `"${name.replace(/"/g, '""')}"`,
}

export const mssqlDialect: DialectConfig = {
  placeholder: (i) => `@p${i}`,
  identifier: (name) => `[${name.replace(/\]/g, "]]")}]`,
}

export { hasFragments }
