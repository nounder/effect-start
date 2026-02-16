import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberRef from "effect/FiberRef"
import * as GlobalValue from "effect/GlobalValue"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Mssql from "mssql"
import * as SqlClient from "../SqlClient.ts"
import * as Values from "../../Values.ts"

const wrapError = (error: unknown): SqlClient.SqlError =>
  new SqlClient.SqlError({
    code:
      (error as any)?.code ??
      ((error as any)?.number != null ? String((error as any).number) : "UNKNOWN"),
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  })

const dialect = SqlClient.mssqlDialect
const makeSpanAttributes = (
  config: Mssql.config & {
    readonly url?: string
    readonly spanAttributes?: Record<string, unknown>
  },
): Record<string, unknown> => {
  const parsed = (() => {
    if (typeof config.url !== "string") return undefined
    try {
      return new URL(config.url)
    } catch {
      return undefined
    }
  })()
  const dbFromPath = parsed?.pathname.replace(/^\/+/, "") || undefined
  const parsedPort = parsed?.port ? Number(parsed.port) : undefined

  return Values.compact({
    ...config.spanAttributes,
    "db.system.name": "microsoft.sql_server",
    "db.namespace": config.database ?? dbFromPath,
    "server.address": config.server ?? parsed?.hostname,
    "server.port": config.port ?? parsedPort,
  })
}

const addInputs = (request: Mssql.Request, values: Array<unknown>) => {
  for (let i = 0; i < values.length; i++) {
    request.input(`p${i + 1}`, values[i])
  }
}

interface TransactionConnection {
  readonly transaction: Mssql.Transaction
  readonly depth: number
}

type MssqlModule = {
  ConnectionPool: new (config: Mssql.config) => Mssql.ConnectionPool
}

const loadMssql = () => import("mssql") as Promise<MssqlModule>

const currentTransaction = GlobalValue.globalValue(
  Symbol.for("effect-start/sql/mssql/currentTransaction"),
  () => FiberRef.unsafeMake<Option.Option<TransactionConnection>>(Option.none()),
)

const makeRequest = (
  pool: Mssql.ConnectionPool,
  txOpt: Option.Option<TransactionConnection>,
  values: Array<unknown>,
): Mssql.Request => {
  const request = Option.isSome(txOpt) ? txOpt.value.transaction.request() : pool.request()
  addInputs(request, values)
  return request
}

const executeQuery = <T>(
  pool: Mssql.ConnectionPool,
  text: string,
  values: Array<unknown>,
): Effect.Effect<ReadonlyArray<T>, SqlClient.SqlError> =>
  Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) =>
    Effect.tryPromise({
      try: () => makeRequest(pool, txOpt, values).query<T>(text),
      catch: wrapError,
    }).pipe(Effect.map((result) => result.recordset ?? [])),
  )

const runUnsafe = <T>(
  pool: Mssql.ConnectionPool,
  query: string,
  values?: Array<unknown>,
): Effect.Effect<ReadonlyArray<T>, SqlClient.SqlError> =>
  Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) =>
    Effect.tryPromise({
      try: () => makeRequest(pool, txOpt, values ?? []).query<T>(query),
      catch: wrapError,
    }).pipe(Effect.map((result) => result.recordset ?? [])),
  )

const makeTaggedTemplate = (pool: Mssql.ConnectionPool) => {
  const unsafeFn = <T = any>(query: string, values?: Array<unknown>) =>
    runUnsafe<T>(pool, query, values)

  return <T = any>(
    strings: TemplateStringsArray,
    ...values: Array<unknown>
  ): Effect.Effect<ReadonlyArray<T>, SqlClient.SqlError> => {
    if (SqlClient.hasFragments(values)) {
      const compiled = SqlClient.interpolate(dialect, strings, values)
      return unsafeFn<T>(compiled.sql, compiled.parameters)
    }

    let text = strings[0]
    for (let i = 0; i < values.length; i++) text += `@p${i + 1}` + strings[i + 1]
    return executeQuery<T>(pool, text, values)
  }
}

const makeQuery = (
  pool: Mssql.ConnectionPool,
  spanAttributes: ReadonlyArray<readonly [string, unknown]>,
): SqlClient.Connection => {
  const query = makeTaggedTemplate(pool)
  const unsafe: SqlClient.Connection["unsafe"] = <T = any>(query: string, values?: Array<unknown>) =>
    runUnsafe<T>(pool, query, values)
  return SqlClient.connection(query, unsafe, { spanAttributes, dialect })
}

const makeWithTransaction =
  (pool: Mssql.ConnectionPool) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, SqlClient.SqlError | E, R> =>
    Effect.uninterruptibleMask((restore) =>
      Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) => {
        if (Option.isSome(txOpt)) {
          const { transaction, depth } = txOpt.value
          const name = `sp_${depth}`
          return Effect.gen(function* () {
            const req = transaction.request()
            yield* Effect.tryPromise({
              try: () => req.query(`SAVE TRANSACTION ${name}`),
              catch: wrapError,
            })
            const exit = yield* Effect.exit(
              restore(
                Effect.locally(
                  self,
                  currentTransaction,
                  Option.some({ transaction, depth: depth + 1 }),
                ),
              ),
            )
            if (Exit.isSuccess(exit)) {
              return exit.value
            }
            const rbReq = transaction.request()
            yield* Effect.tryPromise({
              try: () => rbReq.query(`ROLLBACK TRANSACTION ${name}`),
              catch: wrapError,
            }).pipe(Effect.orDie)
            return yield* exit
          })
        }

        return Effect.gen(function* () {
          const transaction = pool.transaction()
          yield* Effect.tryPromise({ try: () => transaction.begin(), catch: wrapError })
          const exit = yield* Effect.exit(
            restore(
              Effect.locally(self, currentTransaction, Option.some({ transaction, depth: 1 })),
            ),
          )
          if (Exit.isSuccess(exit)) {
            yield* Effect.tryPromise({ try: () => transaction.commit(), catch: wrapError })
            return exit.value
          }
          yield* Effect.tryPromise({ try: () => transaction.rollback(), catch: wrapError }).pipe(
            Effect.orDie,
          )
          return yield* exit
        })
      }),
    )

export const layer = (
  config: Mssql.config & {
    readonly url?: string
    readonly spanAttributes?: Record<string, unknown>
  },
): Layer.Layer<SqlClient.SqlClient, SqlClient.SqlError> =>
  Layer.scoped(
    SqlClient.SqlClient,
    Effect.map(
      Effect.acquireRelease(
        Effect.tryPromise({
          try: async () => {
            const mssql = await loadMssql()
            const driverConfig = { ...config } as Record<string, unknown>
            delete driverConfig.spanAttributes
            delete driverConfig.url
            const pool = await new mssql.ConnectionPool(
              driverConfig as unknown as Mssql.config,
            ).connect()
            return { mssql, pool }
          },
          catch: wrapError,
        }).pipe(
          Effect.map((options) => {
            const driverConfig = { ...config } as Record<string, unknown>
            delete driverConfig.spanAttributes
            delete driverConfig.url
            const spanAttributes = Object.entries(makeSpanAttributes(config))
            const query = makeTaggedTemplate(options.pool)
            const unsafeFn: SqlClient.Connection["unsafe"] = <T = any>(
              query: string,
              values?: Array<unknown>,
            ) => runUnsafe<T>(options.pool, query, values)
            const use: SqlClient.SqlClient["use"] = (fn) =>
              Effect.tryPromise({ try: () => Promise.resolve(fn(options.pool)), catch: wrapError })

            return {
              client: SqlClient.make({
                query,
                unsafe: unsafeFn,
                withTransaction: makeWithTransaction(options.pool),
                spanAttributes,
                dialect,
                reserve: Effect.acquireRelease(
                  Effect.tryPromise({
                    try: () =>
                      new options.mssql.ConnectionPool({
                        ...driverConfig,
                        pool: { max: 1, min: 1 },
                      } as unknown as Mssql.config).connect(),
                    catch: wrapError,
                  }),
                  (reserved: Mssql.ConnectionPool) =>
                    Effect.tryPromise({ try: () => reserved.close(), catch: () => void 0 }).pipe(
                      Effect.asVoid,
                      Effect.orDie,
                    ),
                ).pipe(
                  Effect.map((reserved): SqlClient.Connection => makeQuery(reserved, spanAttributes)),
                ),
                use,
              }),
              close: use((pool) => pool.close()),
            }
          }),
        ),
        (handle) => handle.close.pipe(Effect.orDie),
      ),
      (handle) => handle.client,
    ),
  )
