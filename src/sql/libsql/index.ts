import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberRef from "effect/FiberRef"
import * as GlobalValue from "effect/GlobalValue"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Libsql from "@libsql/client"
import * as SqlClient from "../SqlClient.ts"
import * as Values from "../../Values.ts"

type ConfigOrValue<T> = T | Config.Config<T>

export interface LibsqlConfig {
  readonly url?: ConfigOrValue<string>
  readonly authToken?: ConfigOrValue<string>
  readonly syncUrl?: ConfigOrValue<string>
  readonly syncInterval?: ConfigOrValue<number>
  readonly encryptionKey?: ConfigOrValue<string>
  readonly spanAttributes?: Record<string, unknown>
}

interface ResolvedConfig {
  readonly url: string
  readonly authToken?: string
  readonly syncUrl?: string
  readonly syncInterval?: number
  readonly encryptionKey?: string
  readonly spanAttributes?: Record<string, unknown>
}

const resolveField = <T>(value: ConfigOrValue<T> | undefined) =>
  value === undefined
    ? Effect.succeed(undefined as T | undefined)
    : Config.isConfig(value)
      ? Effect.map(value, (v): T | undefined => v)
      : Effect.succeed(value as T | undefined)

const wrapError = (error: unknown): SqlClient.SqlError =>
  new SqlClient.SqlError({
    code: (error as any)?.code ?? "UNKNOWN",
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  })

const wrap = <T>(fn: () => PromiseLike<T>): Effect.Effect<T, SqlClient.SqlError> =>
  Effect.tryPromise({ try: () => Promise.resolve(fn()), catch: wrapError })

const dialect = SqlClient.sqliteDialect
const makeSpanAttributes = (config: ResolvedConfig): ReadonlyArray<readonly [string, unknown]> => {
  const parsed = (() => {
    try {
      return new URL(config.url)
    } catch {
      return undefined
    }
  })()
  const dbFromPath = parsed?.pathname.replace(/^\/+/, "") || undefined
  const parsedPort = parsed?.port ? Number(parsed.port) : undefined

  return Object.entries(
    Values.compact({
      ...config.spanAttributes,
      "db.system.name": "sqlite",
      "db.namespace": dbFromPath,
      "server.address": parsed?.hostname,
      "server.port": parsedPort,
    }),
  )
}
const resultSetToRows = <T>(result: Libsql.ResultSet): ReadonlyArray<T> => {
  const { columns, rows } = result
  return rows.map((row) => {
    const obj: any = {}
    for (let i = 0; i < columns.length; i++) obj[columns[i]] = row[i]
    return obj
  })
}

const executeQuery = <T>(
  client: Libsql.Client,
  sql: string,
  args: Array<unknown>,
): Effect.Effect<ReadonlyArray<T>, SqlClient.SqlError> =>
  wrap(() => client.execute({ sql, args })).pipe(Effect.map(resultSetToRows<T>))

interface TransactionConnection {
  readonly depth: number
}

type LibsqlModule = {
  createClient: (config: Libsql.Config) => Libsql.Client
}

const loadLibsql = () => import("@libsql/client") as Promise<LibsqlModule>

const currentTransaction = GlobalValue.globalValue(
  Symbol.for("effect-start/sql/libsql/currentTransaction"),
  () => FiberRef.unsafeMake<Option.Option<TransactionConnection>>(Option.none()),
)

const exec = (client: Libsql.Client, sql: string) => wrap(() => client.execute(sql))

const makeTaggedTemplate = (client: Libsql.Client) => {
  const unsafeFn = <T = any>(query: string, values?: Array<unknown>) =>
    executeQuery<T>(client, query, values ?? [])

  return <T = any>(
    strings: TemplateStringsArray,
    ...values: Array<unknown>
  ): Effect.Effect<ReadonlyArray<T>, SqlClient.SqlError> => {
    if (SqlClient.hasFragments(values)) {
      const compiled = SqlClient.interpolate(dialect, strings, values)
      return unsafeFn<T>(compiled.sql, compiled.parameters)
    }

    let sqlText = strings[0]
    for (let i = 0; i < values.length; i++) sqlText += "?" + strings[i + 1]
    return executeQuery<T>(client, sqlText, values)
  }
}

const makeQuery = (
  client: Libsql.Client,
  spanAttributes: ReadonlyArray<readonly [string, unknown]>,
): SqlClient.Connection => {
  const query = makeTaggedTemplate(client)
  const unsafe: SqlClient.Connection["unsafe"] = <T = any>(query: string, values?: Array<unknown>) =>
    executeQuery<T>(client, query, values ?? [])
  return SqlClient.connection(query, unsafe, { spanAttributes, dialect })
}

const makeWithTransaction =
  (client: Libsql.Client) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, SqlClient.SqlError | E, R> =>
    Effect.uninterruptibleMask((restore) =>
      Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) => {
        if (Option.isSome(txOpt)) {
          const { depth } = txOpt.value
          const name = `sp_${depth}`
          return Effect.gen(function* () {
            yield* exec(client, `SAVEPOINT ${name}`)
            const exit = yield* Effect.exit(
              restore(Effect.locally(self, currentTransaction, Option.some({ depth: depth + 1 }))),
            )
            if (Exit.isSuccess(exit)) {
              yield* exec(client, `RELEASE SAVEPOINT ${name}`)
              return exit.value
            }
            yield* exec(client, `ROLLBACK TO SAVEPOINT ${name}`).pipe(Effect.orDie)
            return yield* exit
          })
        }

        return Effect.gen(function* () {
          yield* exec(client, "BEGIN")
          const exit = yield* Effect.exit(
            restore(Effect.locally(self, currentTransaction, Option.some({ depth: 1 }))),
          )
          if (Exit.isSuccess(exit)) {
            yield* exec(client, "COMMIT")
            return exit.value
          }
          yield* exec(client, "ROLLBACK").pipe(Effect.orDie)
          return yield* exit
        })
      }),
    )

export const layer = (config?: LibsqlConfig) =>
  Layer.scoped(
    SqlClient.SqlClient,
    Effect.gen(function* () {
      const envUrl = Option.getOrUndefined(
        yield* Config.option(Config.string("TURSO_DATABASE_URL")),
      )
      const envAuthToken = Option.getOrUndefined(
        yield* Config.option(Config.string("TURSO_AUTH_TOKEN")),
      )
      const configUrl = yield* resolveField(config?.url)
      const configAuthToken = yield* resolveField(config?.authToken)
      const resolved: ResolvedConfig = {
        url: configUrl ?? envUrl ?? ":memory:",
        authToken: configAuthToken ?? envAuthToken,
        syncUrl: yield* resolveField(config?.syncUrl),
        syncInterval: yield* resolveField(config?.syncInterval),
        encryptionKey: yield* resolveField(config?.encryptionKey),
        spanAttributes: config?.spanAttributes,
      }
      const handle = yield* Effect.acquireRelease(
        wrap(() => loadLibsql()).pipe(
          Effect.map((libsql) => {
            const client = libsql.createClient(resolved)
            const spanAttributes = makeSpanAttributes(resolved)
            const query = makeTaggedTemplate(client)
            const unsafeFn: SqlClient.Connection["unsafe"] = <T = any>(
              query: string,
              values?: Array<unknown>,
            ) => executeQuery<T>(client, query, values ?? [])
            const use: SqlClient.SqlClient["use"] = (fn) =>
              Effect.tryPromise({ try: () => Promise.resolve(fn(client)), catch: wrapError })

            return {
              client: SqlClient.make({
                query,
                unsafe: unsafeFn,
                withTransaction: makeWithTransaction(client),
                spanAttributes,
                dialect,
                reserve: Effect.succeed(makeQuery(client, spanAttributes)),
                use,
              }),
              close: Effect.sync(() => client.close()),
            }
          }),
        ),
        (handle) => handle.close.pipe(Effect.orDie),
      )
      return handle.client
    }),
  )
