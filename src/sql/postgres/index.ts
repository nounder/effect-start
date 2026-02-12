import postgres from "postgres"
import type * as Postgres from "postgres"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberRef from "effect/FiberRef"
import * as GlobalValue from "effect/GlobalValue"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Sql from "../../Sql.ts"

const wrapError = (error: unknown): Sql.SqlError =>
  new Sql.SqlError({
    code: (error as any)?.code ?? "UNKNOWN",
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  })

const makeValues: Sql.SqlQuery["values"] = (obj: any, ...columns: Array<string>) => {
  const items = Array.isArray(obj) ? obj : [obj]
  const cols = columns.length > 0 ? columns : Object.keys(items[0])
  return { value: items, columns: cols }
}

interface TxState {
  readonly conn: Postgres.ReservedSql
  readonly depth: number
}

const currentTransaction = GlobalValue.globalValue(
  Symbol.for("effect-start/sql/postgres/currentTransaction"),
  () => FiberRef.unsafeMake<Option.Option<TxState>>(Option.none()),
)

const makeRun =
  (pg: Postgres.Sql) =>
  <T>(fn: (conn: any) => PromiseLike<T>): Effect.Effect<T, Sql.SqlError> =>
    Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) =>
      Effect.tryPromise({
        try: () => Promise.resolve(fn(Option.isSome(txOpt) ? txOpt.value.conn : pg)),
        catch: wrapError,
      }),
    )

const makeWithTransaction =
  (pg: Postgres.Sql) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, Sql.SqlError | E, R> =>
    Effect.uninterruptibleMask((restore) =>
      Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) => {
        if (Option.isSome(txOpt)) {
          const { conn, depth } = txOpt.value
          const name = `sp_${depth}`
          return Effect.gen(function* () {
            yield* Effect.tryPromise({
              try: () => Promise.resolve(conn.unsafe(`SAVEPOINT ${name}`)),
              catch: wrapError,
            })
            const exit = yield* Effect.exit(
              restore(
                Effect.locally(self, currentTransaction, Option.some({ conn, depth: depth + 1 })),
              ),
            )
            if (Exit.isSuccess(exit)) {
              yield* Effect.tryPromise({
                try: () => Promise.resolve(conn.unsafe(`RELEASE SAVEPOINT ${name}`)),
                catch: wrapError,
              })
              return exit.value
            }
            yield* Effect.tryPromise({
              try: () => Promise.resolve(conn.unsafe(`ROLLBACK TO SAVEPOINT ${name}`)),
              catch: wrapError,
            }).pipe(Effect.orDie)
            return yield* exit
          })
        }

        return Effect.acquireUseRelease(
          Effect.tryPromise({ try: () => pg.reserve(), catch: wrapError }),
          (reserved) =>
            Effect.gen(function* () {
              yield* Effect.tryPromise({
                try: () => Promise.resolve(reserved.unsafe("BEGIN")),
                catch: wrapError,
              })
              const exit = yield* Effect.exit(
                restore(
                  Effect.locally(
                    self,
                    currentTransaction,
                    Option.some({ conn: reserved, depth: 1 }),
                  ),
                ),
              )
              if (Exit.isSuccess(exit)) {
                yield* Effect.tryPromise({
                  try: () => Promise.resolve(reserved.unsafe("COMMIT")),
                  catch: wrapError,
                })
                return exit.value
              }
              yield* Effect.tryPromise({
                try: () => Promise.resolve(reserved.unsafe("ROLLBACK")),
                catch: wrapError,
              }).pipe(Effect.orDie)
              return yield* exit
            }),
          (reserved) => Effect.sync(() => reserved.release()),
        )
      }),
    )

export const layer = (
  config: Postgres.Options<{}> | string,
): Layer.Layer<Sql.SqlClient, Sql.SqlError> =>
  Layer.scoped(
    Sql.SqlClient,
    Effect.acquireRelease(
      Effect.try({
        try: () => {
          const pg = postgres(config as any)
          const run = makeRun(pg)
          const use: Sql.SqlClient["use"] = (fn) =>
            Effect.tryPromise({ try: () => Promise.resolve(fn(pg)), catch: wrapError })
          return Object.assign(
            <T = any>(strings: TemplateStringsArray, ...values: Array<unknown>) =>
              run<ReadonlyArray<T>>((conn) => conn(strings, ...(values as any))),
            {
              unsafe: <T = any>(query: string, values?: Array<unknown>) =>
                run<ReadonlyArray<T>>((conn) => conn.unsafe(query, values as any)),
              values: makeValues,
              withTransaction: makeWithTransaction(pg),
              reserve: Effect.acquireRelease(
                Effect.tryPromise({ try: () => pg.reserve(), catch: wrapError }),
                (reserved: Postgres.ReservedSql) => Effect.sync(() => reserved.release()),
              ).pipe(
                Effect.map(
                  (reserved): Sql.SqlQuery =>
                    Object.assign(
                      <T = any>(
                        strings: TemplateStringsArray,
                        ...values: Array<unknown>
                      ): Effect.Effect<ReadonlyArray<T>, Sql.SqlError> =>
                        Effect.tryPromise({
                          try: () => reserved(strings, ...(values as any)) as any,
                          catch: wrapError,
                        }),
                      {
                        unsafe: <T = any>(
                          query: string,
                          values?: Array<unknown>,
                        ): Effect.Effect<ReadonlyArray<T>, Sql.SqlError> =>
                          Effect.tryPromise({
                            try: () => reserved.unsafe(query, values as any) as any,
                            catch: wrapError,
                          }),
                        values: makeValues,
                      },
                    ),
                ),
              ),
              close: (options?: { readonly timeout?: number }) =>
                use((pg) => (pg as Postgres.Sql).end({ timeout: options?.timeout ?? 0 })),
              use,
            },
          ) satisfies Sql.SqlClient
        },
        catch: wrapError,
      }),
      (client) => client.close().pipe(Effect.orDie),
    ),
  )
