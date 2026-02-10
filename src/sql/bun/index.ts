import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberRef from "effect/FiberRef"
import * as GlobalValue from "effect/GlobalValue"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Sql from "../Sql.ts"

const errorCode = (error: unknown): string => {
  const e = error as any
  if (typeof e?.errno === "string") return e.errno
  return e?.code ?? "UNKNOWN"
}

const wrapError = (error: unknown): Sql.SqlError =>
  new Sql.SqlError({
    code: errorCode(error),
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  })

const wrap = <T>(fn: () => PromiseLike<T>): Effect.Effect<T, Sql.SqlError> =>
  Effect.tryPromise({ try: () => Promise.resolve(fn()), catch: wrapError })

interface TxState {
  readonly conn: any
  readonly depth: number
}

const currentTransaction = GlobalValue.globalValue(
  Symbol.for("effect-start/sql/bun/currentTransaction"),
  () => FiberRef.unsafeMake<Option.Option<TxState>>(Option.none()),
)

const makeRun =
  (bunSql: any) =>
  <T>(fn: (conn: any) => PromiseLike<T>): Effect.Effect<T, Sql.SqlError> =>
    Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) =>
      wrap(() => fn(Option.isSome(txOpt) ? txOpt.value.conn : bunSql)),
    )

const detectDialect = (bunSql: any): Sql.DialectConfig => {
  const adapter = bunSql?.options?.adapter ?? bunSql?.adapter
  if (adapter === "sqlite") return Sql.sqliteDialect
  return Sql.postgresDialect
}

const makeTaggedTemplate = (
  run: <T>(fn: (conn: any) => PromiseLike<T>) => Effect.Effect<T, Sql.SqlError>,
  dialect: Sql.DialectConfig,
) => {
  const unsafeFn = <T = any>(query: string, values?: Array<unknown>) =>
    run<ReadonlyArray<T>>((conn) => conn.unsafe(query, values))

  return <T = any>(strings: TemplateStringsArray, ...values: Array<unknown>): Sql.SqlStatement<T> => {
    if (Sql.hasFragments(values)) {
      const compiled = Sql.compileQuery(dialect, strings, values)
      return Sql.makeSqlStatement<T>(unsafeFn<T>(compiled.sql, compiled.values))
    }

    const effect = run<ReadonlyArray<T>>((conn) => conn(strings, ...values))
    return Sql.makeSqlStatement<T>(effect, {
      values: () =>
        run<ReadonlyArray<ReadonlyArray<unknown>>>((conn) =>
          conn(strings, ...values).values(),
        ),
      raw: () =>
        run<ReadonlyArray<ReadonlyArray<Uint8Array>>>((conn) =>
          conn(strings, ...values).raw(),
        ),
      simple: () =>
        run<ReadonlyArray<T>>((conn) => conn(strings, ...values).simple()),
    })
  }
}

const makeQuery = (
  run: <T>(fn: (conn: any) => PromiseLike<T>) => Effect.Effect<T, Sql.SqlError>,
  dialect: Sql.DialectConfig,
): Sql.SqlQuery => {
  const taggedTemplate = makeTaggedTemplate(run, dialect)
  const unsafeFn: Sql.SqlQuery["unsafe"] = <T = any>(query: string, values?: Array<unknown>) =>
    run<ReadonlyArray<T>>((conn) => conn.unsafe(query, values))

  return Object.assign(Sql.dispatchCallable(taggedTemplate), {
    unsafe: unsafeFn,
  }) as unknown as Sql.SqlQuery
}

const makeWithTransaction =
  (bunSql: any) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, Sql.SqlError | E, R> =>
    Effect.uninterruptibleMask((restore) =>
      Effect.flatMap(FiberRef.get(currentTransaction), (txOpt) => {
        if (Option.isSome(txOpt)) {
          const { conn, depth } = txOpt.value
          const name = `sp_${depth}`
          return Effect.gen(function* () {
            yield* wrap(() => conn.unsafe(`SAVEPOINT ${name}`))
            const exit = yield* Effect.exit(
              restore(
                Effect.locally(self, currentTransaction, Option.some({ conn, depth: depth + 1 })),
              ),
            )
            if (Exit.isSuccess(exit)) {
              yield* wrap(() => conn.unsafe(`RELEASE SAVEPOINT ${name}`))
              return exit.value
            }
            yield* wrap(() => conn.unsafe(`ROLLBACK TO SAVEPOINT ${name}`)).pipe(Effect.orDie)
            return yield* exit
          })
        }

        const runTx = (conn: any) =>
          Effect.gen(function* () {
            yield* wrap(() => conn.unsafe("BEGIN"))
            const exit = yield* Effect.exit(
              restore(Effect.locally(self, currentTransaction, Option.some({ conn, depth: 1 }))),
            )
            if (Exit.isSuccess(exit)) {
              yield* wrap(() => conn.unsafe("COMMIT"))
              return exit.value
            }
            yield* wrap(() => conn.unsafe("ROLLBACK")).pipe(Effect.orDie)
            return yield* exit
          })

        return Effect.matchEffect(
          wrap(() => bunSql.reserve()),
          {
            onFailure: () => runTx(bunSql),
            onSuccess: (reserved: any) =>
              Effect.ensuring(
                runTx(reserved),
                Effect.sync(() => reserved.release()),
              ),
          },
        )
      }),
    )

export const layer = (
  config: ConstructorParameters<typeof Bun.SQL>[0],
): Layer.Layer<Sql.SqlClient, Sql.SqlError> =>
  Layer.scoped(
    Sql.SqlClient,
    Effect.acquireRelease(
      Effect.try({
        try: () => {
          const bunSql = new Bun.SQL(config as any)
          const run = makeRun(bunSql)
          const dialect = detectDialect(bunSql)
          const unsafeFn: Sql.SqlQuery["unsafe"] = <T = any>(query: string, values?: Array<unknown>) =>
            run<ReadonlyArray<T>>((conn) => conn.unsafe(query, values))
          const taggedTemplate = makeTaggedTemplate(run, dialect)
          const use: Sql.SqlClient["use"] = (fn) =>
            Effect.tryPromise({ try: () => Promise.resolve(fn(bunSql)), catch: wrapError })

          return Object.assign(Sql.dispatchCallable(taggedTemplate), {
            unsafe: unsafeFn,
            withTransaction: makeWithTransaction(bunSql),
            reserve: Effect.acquireRelease(
              wrap(() => bunSql.reserve()),
              (reserved: any) => Effect.sync(() => reserved.release()),
            ).pipe(
              Effect.map((reserved: any): Sql.SqlQuery => {
                const reservedRun = <T>(fn: (conn: any) => PromiseLike<T>) =>
                  wrap<T>(() => fn(reserved))
                return makeQuery(reservedRun, dialect)
              }),
            ),
            close: (options?: { readonly timeout?: number }) =>
              use((bunSql) => bunSql.close(options)),
            use,
            array: (values: ReadonlyArray<unknown>): Sql.SqlFragment =>
              Sql.SqlFragment.arrayLiteral(values),
            file: Sql.makeFile(unsafeFn),
          }) as unknown as Sql.SqlClient
        },
        catch: wrapError,
      }),
      (client) => client.close().pipe(Effect.orDie),
    ),
  )
