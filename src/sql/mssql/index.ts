import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberRef from "effect/FiberRef"
import * as GlobalValue from "effect/GlobalValue"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Mssql from "mssql"
import * as Sql from "../Sql.ts"

export interface MssqlConfig {
  readonly server: string
  readonly database?: string
  readonly user?: string
  readonly password?: string
  readonly port?: number
  readonly pool?: {
    readonly max?: number
    readonly min?: number
    readonly idleTimeoutMillis?: number
  }
  readonly options?: {
    readonly encrypt?: boolean
    readonly trustServerCertificate?: boolean
    readonly requestTimeout?: number
    readonly connectionTimeout?: number
  }
}

const wrapError = (error: unknown): Sql.SqlError =>
  new Sql.SqlError({
    code:
      (error as any)?.code ??
      ((error as any)?.number != null ? String((error as any).number) : "UNKNOWN"),
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  })

const dialect = Sql.mssqlDialect

const addInputs = (request: Mssql.Request, values: Array<unknown>) => {
  for (let i = 0; i < values.length; i++) {
    request.input(`p${i + 1}`, values[i])
  }
}

interface TxState {
  readonly transaction: Mssql.Transaction
  readonly depth: number
}

type MssqlModule = {
  ConnectionPool: new (config: Mssql.config) => Mssql.ConnectionPool
}

const loadMssql = () => import("mssql") as Promise<MssqlModule>

const currentTransaction = GlobalValue.globalValue(
  Symbol.for("effect-start/sql/mssql/currentTransaction"),
  () => FiberRef.unsafeMake<Option.Option<TxState>>(Option.none()),
)

const makeRequest = (
  pool: Mssql.ConnectionPool,
  txOpt: Option.Option<TxState>,
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
): Effect.Effect<ReadonlyArray<T>, Sql.SqlError> =>
  Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) =>
    Effect.tryPromise({
      try: () => makeRequest(pool, txOpt, values).query<T>(text),
      catch: wrapError,
    }).pipe(Effect.map((result) => result.recordset ?? [])),
  )

const executeQueryValues = (
  pool: Mssql.ConnectionPool,
  text: string,
  values: Array<unknown>,
): Effect.Effect<ReadonlyArray<ReadonlyArray<unknown>>, Sql.SqlError> =>
  Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) =>
    Effect.tryPromise({
      try: () => makeRequest(pool, txOpt, values).query(text),
      catch: wrapError,
    }).pipe(
      Effect.map((result) =>
        (result.recordset ?? []).map((row: any) => Object.values(row)),
      ),
    ),
  )

const runUnsafe = <T>(
  pool: Mssql.ConnectionPool,
  query: string,
  values?: Array<unknown>,
): Effect.Effect<ReadonlyArray<T>, Sql.SqlError> =>
  Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) =>
    Effect.tryPromise({
      try: () => makeRequest(pool, txOpt, values ?? []).query<T>(query),
      catch: wrapError,
    }).pipe(Effect.map((result) => result.recordset ?? [])),
  )

const makeTaggedTemplate = (pool: Mssql.ConnectionPool) => {
  const unsafeFn = <T = any>(query: string, values?: Array<unknown>) =>
    runUnsafe<T>(pool, query, values)

  return <T = any>(strings: TemplateStringsArray, ...values: Array<unknown>): Sql.SqlStatement<T> => {
    if (Sql.hasFragments(values)) {
      const compiled = Sql.compileQuery(dialect, strings, values)
      return Sql.makeSqlStatement<T>(unsafeFn<T>(compiled.sql, compiled.values))
    }

    let text = strings[0]
    for (let i = 0; i < values.length; i++) text += `@p${i + 1}` + strings[i + 1]
    return Sql.makeSqlStatement<T>(executeQuery<T>(pool, text, values), {
      values: () => executeQueryValues(pool, text, values),
    })
  }
}

const makeQuery = (pool: Mssql.ConnectionPool): Sql.SqlQuery => {
  const taggedTemplate = makeTaggedTemplate(pool)
  const unsafeFn: Sql.SqlQuery["unsafe"] = <T = any>(query: string, values?: Array<unknown>) =>
    runUnsafe<T>(pool, query, values)

  return Object.assign(Sql.dispatchCallable(taggedTemplate), {
    unsafe: unsafeFn,
  }) as unknown as Sql.SqlQuery
}

const makeWithTransaction =
  (pool: Mssql.ConnectionPool) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, Sql.SqlError | E, R> =>
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

export const layer = (config: MssqlConfig): Layer.Layer<Sql.SqlClient, Sql.SqlError> =>
  Layer.scoped(
    Sql.SqlClient,
    Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const mssql = await loadMssql()
          const pool = await new mssql.ConnectionPool(config as Mssql.config).connect()
          return { mssql, pool }
        },
        catch: wrapError,
      }).pipe(
        Effect.map(({ mssql, pool }) => {
          const taggedTemplate = makeTaggedTemplate(pool)
          const unsafeFn: Sql.SqlQuery["unsafe"] = <T = any>(query: string, values?: Array<unknown>) =>
            runUnsafe<T>(pool, query, values)
          const use: Sql.Service["use"] = (fn) =>
            Effect.tryPromise({ try: () => Promise.resolve(fn(pool)), catch: wrapError })

          return Sql.of(taggedTemplate, {
            unsafe: unsafeFn,
            withTransaction: makeWithTransaction(pool),
            reserve: Effect.acquireRelease(
              Effect.tryPromise({
                try: () =>
                  new mssql.ConnectionPool({
                    ...config,
                    pool: { max: 1, min: 1 },
                  } as Mssql.config).connect(),
                catch: wrapError,
              }),
              (reserved: Mssql.ConnectionPool) =>
                Effect.tryPromise({ try: () => reserved.close(), catch: () => void 0 }).pipe(
                  Effect.asVoid,
                  Effect.orDie,
                ),
            ).pipe(
              Effect.map((reserved): Sql.SqlQuery => makeQuery(reserved)),
            ),
            close: () => use((pool) => pool.close()),
            use,
          })
        }),
      ),
      (client) => client.close().pipe(Effect.orDie),
    ),
  )
