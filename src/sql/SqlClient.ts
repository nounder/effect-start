import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberRef from "effect/FiberRef"
import * as GlobalValue from "effect/GlobalValue"
import type * as Scope from "effect/Scope"
import * as Values from "../Values.ts"

export class SqlError extends Data.TaggedError("SqlError")<{
  readonly code: string
  readonly message: string
  readonly cause?: unknown
}> {}

export interface DialectConfig {
  readonly placeholder: (index: number) => string
  readonly identifier: (name: string) => string
}

export type SqlRow = Record<string, unknown>

export interface Connection {
  /**
   * Execute a parameterized query via tagged template literal
   */
  <A extends object = SqlRow>(
    strings: TemplateStringsArray,
    ...values: Array<unknown>
  ): Effect.Effect<ReadonlyArray<A>, SqlError>
  /**
   * Create a safely-escaped SQL identifier from a string
   */
  (name: string): unknown
  /**
   * Build a VALUES clause from an object or array of objects,
   * optionally picking specific columns
   */
  <T extends Record<string, unknown>, K extends keyof T>(
    obj: T | ReadonlyArray<T>,
    columns?: [K, ...Array<K>],
  ): unknown
  /**
   * Build an IN-list from an array of primitive values
   */
  (values: ReadonlyArray<string | number | boolean | null>): unknown

  /**
   * Execute a raw SQL string without tagged template escaping
   */
  readonly unsafe: <A extends object = SqlRow>(
    query: string,
    values?: Array<unknown>,
  ) => Effect.Effect<ReadonlyArray<A>, SqlError>
}

export interface SqlClient extends Connection {
  /**
   * Run an effect inside a transaction
   */
  readonly withTransaction: <A, E, R>(
    self: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, SqlError | E, R>

  /**
   * Reserve a dedicated connection from the pool
   */
  readonly reserve: Effect.Effect<Connection, SqlError, Scope.Scope>

  /**
   * Access the underlying database driver directly
   */
  readonly use: <T>(fn: (driver: any) => Promise<T> | T) => Effect.Effect<T, SqlError>
}

export const SqlClient: Context.Tag<SqlClient, SqlClient> = Context.GenericTag<SqlClient>(
  "effect-start/Sql/SqlClient",
)

export type TaggedQuery = <A extends object = SqlRow>(
  strings: TemplateStringsArray,
  ...values: Array<unknown>
) => Effect.Effect<ReadonlyArray<A>, SqlError>

export interface MakeOptions {
  readonly withTransaction: SqlClient["withTransaction"]
  readonly reserve: SqlClient["reserve"]
  readonly use: SqlClient["use"]
  readonly unsafe: Connection["unsafe"]
  readonly query: TaggedQuery
  readonly spanAttributes: ReadonlyArray<readonly [string, unknown]>
  readonly dialect: DialectConfig
}

export function make(options: MakeOptions): SqlClient {
  const trace = makeTraceOptions(options.spanAttributes, options.dialect)
  const query = withExecuteSpan(options.query, trace)
  const unsafe = withUnsafeExecuteSpan(options.unsafe, trace)
  const withTransaction = withTransactionSpan(options.withTransaction, trace.spanAttributes)

  return Object.assign(dispatchCallable(query), {
    ...options,
    query,
    unsafe,
    withTransaction,
  }) as unknown as SqlClient
}

export function connection(
  query: TaggedQuery,
  unsafe: Connection["unsafe"],
  options?: {
    readonly spanAttributes?: ReadonlyArray<readonly [string, unknown]>
    readonly dialect?: DialectConfig
  },
): Connection {
  const trace = makeTraceOptions(options?.spanAttributes, options?.dialect)
  const tracedQuery = withExecuteSpan(query, trace)
  const tracedUnsafe = withUnsafeExecuteSpan(unsafe, trace)
  return Object.assign(dispatchCallable(tracedQuery), {
    unsafe: tracedUnsafe,
  }) as unknown as Connection
}

function dispatchCallable(query: TaggedQuery) {
  return (first: any, ...rest: Array<any>) => {
    if (Values.isTemplateStringsArray(first)) return query(first, ...rest)
    if (typeof first === "string") return makeIdentifier(first)
    if (
      Array.isArray(first) &&
      (first.length === 0 || typeof first[0] !== "object" || first[0] === null)
    )
      return makeList(first)
    return makeValues(first, rest[0])
  }
}

/**
 * Interpolate fragments into a SQL string and parameter array.
 **/
export function interpolate(
  dialect: DialectConfig,
  strings: TemplateStringsArray,
  interpolations: Array<unknown>,
): { readonly sql: string; readonly parameters: Array<unknown> } {
  const parts: Array<string> = []
  const parameters: Array<unknown> = []
  let pi = 1

  const pushItems = (items: ReadonlyArray<unknown>) => {
    const ph: Array<string> = []
    for (const item of items) {
      ph.push(dialect.placeholder(pi++))
      parameters.push(item)
    }
    return ph.join(", ")
  }

  parts.push(strings[0])
  for (let i = 0; i < interpolations.length; i++) {
    const frag = isSqlFragment(interpolations[i])
    if (frag) {
      const tag = frag[SqlFragmentTag]
      if (tag === "Identifier") parts.push(dialect.identifier(frag.name))
      else if (tag === "List") parts.push(`(${pushItems(frag.items)})`)
      else if (tag === "Values") {
        const cols = frag.columns.map((c) => dialect.identifier(c as string)).join(", ")
        const rows = frag.value
          .map((row) => `(${pushItems(frag.columns.map((c) => row[c as string]))})`)
          .join(", ")
        parts.push(`(${cols}) VALUES ${rows}`)
      }
    } else {
      parts.push(dialect.placeholder(pi++))
      parameters.push(interpolations[i])
    }
    parts.push(strings[i + 1])
  }
  return { sql: parts.join(""), parameters }
}

export function hasFragments(values: Array<unknown>): boolean {
  return values.some((v) => isSqlFragment(v) !== undefined)
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

const SqlFragmentTag = Symbol.for("effect-start/Sql/SqlFragment")

type SqlFragment =
  | { readonly [SqlFragmentTag]: "Identifier"; readonly name: string }
  | {
      readonly [SqlFragmentTag]: "Values"
      readonly value: ReadonlyArray<Record<string, unknown>>
      readonly columns: ReadonlyArray<string>
    }
  | { readonly [SqlFragmentTag]: "List"; readonly items: ReadonlyArray<unknown> }

const makeIdentifier = (name: string): SqlFragment => ({ [SqlFragmentTag]: "Identifier", name })

const makeValues = <T extends Record<string, unknown>>(
  obj: T | ReadonlyArray<T>,
  columns?: Array<keyof T & string>,
): SqlFragment => {
  const items = Array.isArray(obj) ? obj : [obj]
  const cols = columns && columns.length > 0 ? columns : (Object.keys(items[0]) as Array<string>)
  return { [SqlFragmentTag]: "Values", value: items, columns: cols }
}

const makeList = (items: ReadonlyArray<unknown>): SqlFragment => ({
  [SqlFragmentTag]: "List",
  items,
})

const isSqlFragment = (value: unknown): SqlFragment | undefined =>
  value !== null && typeof value === "object" && SqlFragmentTag in value
    ? (value as SqlFragment)
    : undefined

const currentTransactionDepth = GlobalValue.globalValue(
  Symbol.for("effect-start/sql/currentTransactionDepth"),
  () => FiberRef.unsafeMake(0),
)

const withExecuteSpan =
  (
    query: TaggedQuery,
    options: {
      readonly spanAttributes: Record<string, unknown>
      readonly dialect: DialectConfig
    },
  ): TaggedQuery =>
  <A extends object = SqlRow>(
    strings: TemplateStringsArray,
    ...values: Array<unknown>
  ): Effect.Effect<ReadonlyArray<A>, SqlError> =>
    query<A>(strings, ...values).pipe(
      Effect.withSpan("sql.execute", {
        kind: "client",
        attributes: {
          ...options.spanAttributes,
          "db.operation.name": "execute",
          "db.query.text": renderTemplateSql(options.dialect, strings, values),
        },
        captureStackTrace: false,
      }),
    )

const withUnsafeExecuteSpan =
  (
    unsafe: Connection["unsafe"],
    options: {
      readonly spanAttributes: Record<string, unknown>
    },
  ): Connection["unsafe"] =>
  <A extends object = SqlRow>(
    query: string,
    values?: Array<unknown>,
  ): Effect.Effect<ReadonlyArray<A>, SqlError> =>
    unsafe<A>(query, values).pipe(
      Effect.withSpan("sql.execute", {
        kind: "client",
        attributes: {
          ...options.spanAttributes,
          "db.operation.name": "executeRaw",
          "db.query.text": query,
        },
        captureStackTrace: false,
      }),
    )

const withTransactionSpan =
  (
    withTransaction: SqlClient["withTransaction"],
    spanAttributes: Record<string, unknown>,
  ): SqlClient["withTransaction"] =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, SqlError | E, R> =>
    Effect.flatMap(FiberRef.get(currentTransactionDepth), (depth) =>
      Effect.useSpan(
        "sql.transaction",
        {
          kind: "client",
          attributes: spanAttributes,
          captureStackTrace: false,
        },
        (span) =>
          Effect.flatMap(
            Effect.exit(
              Effect.withParentSpan(
                Effect.locally(withTransaction(self), currentTransactionDepth, depth + 1),
                span,
              ),
            ),
            (exit) =>
              Effect.flatMap(Clock.currentTimeNanos, (timestamp) =>
                Effect.zipRight(
                  Effect.sync(() =>
                    span.event(
                      Exit.isSuccess(exit)
                        ? depth === 0
                          ? "db.transaction.commit"
                          : "db.transaction.savepoint"
                        : "db.transaction.rollback",
                      timestamp,
                    ),
                  ),
                  exit,
                ),
              ),
          ),
      ),
    )

const makeTraceOptions = (
  spanAttributes: ReadonlyArray<readonly [string, unknown]> | undefined,
  dialect: DialectConfig | undefined,
): {
  readonly spanAttributes: Record<string, unknown>
  readonly dialect: DialectConfig
} => ({
  spanAttributes: spanAttributes ? Object.fromEntries(spanAttributes) : {},
  dialect: dialect ?? sqliteDialect,
})

const renderTemplateSql = (
  dialect: DialectConfig,
  strings: TemplateStringsArray,
  values: Array<unknown>,
): string => {
  if (hasFragments(values)) {
    return interpolate(dialect, strings, values).sql
  }

  let sql = strings[0]
  for (let i = 0; i < values.length; i++) {
    sql += dialect.placeholder(i + 1) + strings[i + 1]
  }
  return sql
}
