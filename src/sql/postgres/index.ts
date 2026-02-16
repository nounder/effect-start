import postgres from "postgres"
import type * as Postgres from "postgres"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberRef from "effect/FiberRef"
import * as GlobalValue from "effect/GlobalValue"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as SqlClient from "../SqlClient.ts"

type PgConfig = string | Postgres.Options<Record<string, Postgres.PostgresType>>

const toPgTemplateValues = (values: Array<unknown>): Array<Postgres.ParameterOrFragment<never>> =>
  values as unknown as Array<Postgres.ParameterOrFragment<never>>

const toPgUnsafeValues = (
  values?: Array<unknown>,
): Array<Postgres.ParameterOrJSON<never>> | undefined =>
  values === undefined ? undefined : (values as unknown as Array<Postgres.ParameterOrJSON<never>>)

const getErrorCode = (error: unknown): string => {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { readonly code: unknown }).code
    if (typeof code === "string") {
      return code
    }
  }
  return "UNKNOWN"
}

const wrapError = (error: unknown): SqlClient.SqlError =>
  new SqlClient.SqlError({
    code: getErrorCode(error),
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  })

interface TxState {
  readonly conn: Postgres.ReservedSql
  readonly depth: number
}

const currentTransaction = GlobalValue.globalValue(
  Symbol.for("effect-start/sql/postgres/currentTransaction"),
  () => FiberRef.unsafeMake<Option.Option<TxState>>(Option.none()),
)

const runTemplate = <T extends object = SqlClient.SqlRow>(
  pg: Postgres.Sql,
  strings: TemplateStringsArray,
  values: Array<unknown>,
): Effect.Effect<ReadonlyArray<T>, SqlClient.SqlError> =>
  Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) =>
    Effect.tryPromise({
      try: () => {
        const args = toPgTemplateValues(values)
        if (Option.isSome(txOpt)) {
          return Promise.resolve(
            txOpt.value.conn<ReadonlyArray<T>>(strings, ...args) as unknown as ReadonlyArray<T>,
          )
        }
        return Promise.resolve(
          pg<ReadonlyArray<T>>(strings, ...args) as unknown as ReadonlyArray<T>,
        )
      },
      catch: wrapError,
    }),
  )

const runUnsafe = <T extends object = SqlClient.SqlRow>(
  pg: Postgres.Sql,
  query: string,
  values?: Array<unknown>,
): Effect.Effect<ReadonlyArray<T>, SqlClient.SqlError> =>
  Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) =>
    Effect.tryPromise({
      try: () => {
        const args = toPgUnsafeValues(values)
        if (Option.isSome(txOpt)) {
          return Promise.resolve(
            txOpt.value.conn.unsafe<Array<T>>(query, args) as unknown as ReadonlyArray<T>,
          )
        }
        return Promise.resolve(pg.unsafe<Array<T>>(query, args) as unknown as ReadonlyArray<T>)
      },
      catch: wrapError,
    }),
  )

const makeWithTransaction =
  (pg: Postgres.Sql) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, SqlClient.SqlError | E, R> =>
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

const dialect = SqlClient.postgresDialect
const spanAttributes: ReadonlyArray<readonly [string, unknown]> = [["db.system.name", "postgresql"]]

const makeTaggedTemplate = (pg: Postgres.Sql) => {
  const unsafeFn: SqlClient.UnsafeQuery = <T extends object = SqlClient.SqlRow>(
    query: string,
    values?: Array<unknown>,
  ) => runUnsafe<T>(pg, query, values)

  const query = <T extends object = SqlClient.SqlRow>(
    strings: TemplateStringsArray,
    ...values: Array<unknown>
  ): Effect.Effect<ReadonlyArray<T>, SqlClient.SqlError> => {
    if (SqlClient.hasFragments(values)) {
      const compiled = SqlClient.interpolate(dialect, strings, values)
      return unsafeFn<T>(compiled.sql, compiled.parameters)
    }
    return runTemplate<T>(pg, strings, values)
  }

  return { query, unsafeFn }
}

const makeReservedConnection = (reserved: Postgres.ReservedSql): SqlClient.Connection => {
  const query = <T extends object = SqlClient.SqlRow>(
    strings: TemplateStringsArray,
    ...values: Array<unknown>
  ): Effect.Effect<ReadonlyArray<T>, SqlClient.SqlError> =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          reserved<ReadonlyArray<T>>(
            strings,
            ...toPgTemplateValues(values),
          ) as unknown as ReadonlyArray<T>,
        ),
      catch: wrapError,
    })

  const unsafe: SqlClient.UnsafeQuery = <T extends object = SqlClient.SqlRow>(
    queryText: string,
    values?: Array<unknown>,
  ): Effect.Effect<ReadonlyArray<T>, SqlClient.SqlError> =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          reserved.unsafe<Array<T>>(
            queryText,
            toPgUnsafeValues(values),
          ) as unknown as ReadonlyArray<T>,
        ),
      catch: wrapError,
    })

  return SqlClient.connection(query, unsafe, { spanAttributes, dialect })
}

export const layer = (config: PgConfig): Layer.Layer<SqlClient.SqlClient, SqlClient.SqlError> =>
  Layer.scoped(
    SqlClient.SqlClient,
    Effect.map(
      Effect.acquireRelease(
        Effect.try({
          try: () => {
            const pg =
              typeof config === "string"
                ? postgres(config)
                : postgres(config as Postgres.Options<Record<string, Postgres.PostgresType>>)
            const tagged = makeTaggedTemplate(pg)
            const use: SqlClient.SqlClient["use"] = (fn) =>
              Effect.tryPromise({ try: () => Promise.resolve(fn(pg)), catch: wrapError })

            return {
              client: SqlClient.make({
                query: tagged.query,
                unsafe: tagged.unsafeFn,
                withTransaction: makeWithTransaction(pg),
                spanAttributes,
                dialect,
                reserve: Effect.acquireRelease(
                  Effect.tryPromise({ try: () => pg.reserve(), catch: wrapError }),
                  (reserved: Postgres.ReservedSql) => Effect.sync(() => reserved.release()),
                ).pipe(
                  Effect.map((reserved): SqlClient.Connection => makeReservedConnection(reserved)),
                ),
                use,
              }),
              close: use((driver) => (driver as Postgres.Sql).end({ timeout: 0 })),
            }
          },
          catch: wrapError,
        }),
        (handle) => handle.close.pipe(Effect.orDie),
      ),
      (handle) => handle.client,
    ),
  )
