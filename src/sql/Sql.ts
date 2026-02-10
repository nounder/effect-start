import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"

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
  | { readonly [SqlFragmentTag]: "ArrayLiteral"; readonly items: ReadonlyArray<unknown> }
  | { readonly [SqlFragmentTag]: "Literal"; readonly sql: string }

export const SqlFragment = {
  identifier: (name: string): SqlFragment => ({ [SqlFragmentTag]: "Identifier", name }),
  values: <T extends Record<string, unknown>>(
    obj: T | ReadonlyArray<T>,
    ...columns: Array<keyof T & string>
  ): SqlFragment => {
    const items = Array.isArray(obj) ? obj : [obj]
    const cols = columns.length > 0 ? columns : (Object.keys(items[0]) as Array<string>)
    return { [SqlFragmentTag]: "Values", value: items, columns: cols }
  },
  list: (items: ReadonlyArray<unknown>): SqlFragment => ({ [SqlFragmentTag]: "List", items }),
  arrayLiteral: (items: ReadonlyArray<unknown>): SqlFragment => ({
    [SqlFragmentTag]: "ArrayLiteral",
    items,
  }),
  literal: (sql: string): SqlFragment => ({ [SqlFragmentTag]: "Literal", sql }),
} as const

const isSqlFragment = (value: unknown): value is SqlFragment =>
  value !== null && typeof value === "object" && SqlFragmentTag in value

export interface SqlStatement<T> extends Effect.Effect<ReadonlyArray<T>, SqlError> {
  readonly values: () => Effect.Effect<ReadonlyArray<ReadonlyArray<unknown>>, SqlError>
  readonly raw: () => Effect.Effect<ReadonlyArray<ReadonlyArray<Uint8Array>>, SqlError>
  readonly simple: () => Effect.Effect<ReadonlyArray<T>, SqlError>
}

export const makeSqlStatement = <T>(
  effect: Effect.Effect<ReadonlyArray<T>, SqlError>,
  options?: {
    readonly values?: () => Effect.Effect<ReadonlyArray<ReadonlyArray<unknown>>, SqlError>
    readonly raw?: () => Effect.Effect<ReadonlyArray<ReadonlyArray<Uint8Array>>, SqlError>
    readonly simple?: () => Effect.Effect<ReadonlyArray<T>, SqlError>
  },
): SqlStatement<T> => {
  const suspended = Effect.suspend(() => effect)
  return Object.assign(suspended, {
    values: options?.values ?? (() => Effect.die("values() not supported")),
    raw: options?.raw ?? (() => Effect.die("raw() not supported")),
    simple: options?.simple ?? (() => Effect.die("simple() not supported")),
  }) as unknown as SqlStatement<T>
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
    const v = interpolations[i]
    if (isSqlFragment(v)) {
      const tag = v[SqlFragmentTag]
      if (tag === "Identifier") parts.push(dialect.identifier(v.name))
      else if (tag === "Literal") parts.push(v.sql)
      else if (tag === "List") parts.push(`(${pushItems(v.items)})`)
      else if (tag === "ArrayLiteral") parts.push(`ARRAY[${pushItems(v.items)}]`)
      else if (tag === "Values") {
        const cols = v.columns.map((c) => dialect.identifier(c as string)).join(", ")
        const rows = v.value.map((row) => `(${pushItems(v.columns.map((c) => row[c as string]))})`).join(", ")
        parts.push(`(${cols}) VALUES ${rows}`)
      }
    } else {
      parts.push(dialect.placeholder(pi++))
      values.push(v)
    }
    parts.push(strings[i + 1])
  }
  return { sql: parts.join(""), values }
}

const hasFragments = (values: Array<unknown>): boolean => values.some(isSqlFragment)

export const makeFile =
  (unsafe: <T>(query: string, values?: Array<unknown>) => Effect.Effect<ReadonlyArray<T>, SqlError>) =>
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

export const isTemplateStringsArray = (value: unknown): value is TemplateStringsArray =>
  Array.isArray(value) && "raw" in value

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

export interface SqlClient extends SqlQuery {
  readonly withTransaction: <A, E, R>(
    self: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, SqlError | E, R>

  readonly reserve: Effect.Effect<SqlQuery, SqlError, Scope.Scope>

  readonly close: (options?: { readonly timeout?: number }) => Effect.Effect<void, SqlError>

  readonly use: <T>(fn: (driver: any) => Promise<T> | T) => Effect.Effect<T, SqlError>

  readonly array: (values: ReadonlyArray<unknown>) => SqlFragment

  readonly file: <T = any>(
    filename: string,
    values?: Array<unknown>,
  ) => Effect.Effect<ReadonlyArray<T>, SqlError>
}

export const SqlClient: Context.Tag<SqlClient, SqlClient> = Context.GenericTag<SqlClient>(
  "effect-start/Sql/SqlClient",
)

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
