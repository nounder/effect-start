/**
 * Ported from effect@4.0.0-rc.112.
 */
import { Database } from "bun:sqlite"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import * as Semaphore from "effect/Semaphore"
import * as Stream from "effect/Stream"
import * as Reactivity from "effect/unstable/reactivity/Reactivity"
import * as Client from "effect/unstable/sql/SqlClient"
import type * as SqlConnection from "effect/unstable/sql/SqlConnection"
import * as SqlError from "effect/unstable/sql/SqlError"
import * as Statement from "effect/unstable/sql/Statement"

const ATTR_DB_SYSTEM_NAME = "db.system.name"
const MAX_BUSY_TIMEOUT = 2_147_483_647

const classifyError = (cause: unknown, message: string, operation: string) =>
  SqlError.classifySqliteError(cause, { message, operation })

export const TypeId: TypeId = "~effect-start/bun/SqliteClient"

export type TypeId = "~effect-start/bun/SqliteClient"

export interface SqliteClient extends Client.SqlClient {
  readonly [TypeId]: TypeId
  readonly config: SqliteClientConfig
  readonly export: Effect.Effect<Uint8Array, SqlError.SqlError>
  readonly loadExtension: (path: string) => Effect.Effect<void, SqlError.SqlError>

  readonly updateValues: never
}

export const SqliteClient = Context.Service<SqliteClient>("effect-start/bun/SqliteClient")

export interface SqliteClientConfig {
  readonly filename: string
  readonly readonly?: boolean | undefined
  readonly create?: boolean | undefined
  readonly readwrite?: boolean | undefined
  readonly disableWAL?: boolean | undefined

  readonly busyTimeout?: Duration.Input | undefined

  readonly spanAttributes?: Record<string, unknown> | undefined

  readonly transformResultNames?: ((str: string) => string) | undefined
  readonly transformQueryNames?: ((str: string) => string) | undefined
}

interface SqliteConnection extends SqlConnection.Connection {
  readonly export: Effect.Effect<Uint8Array, SqlError.SqlError>
  readonly loadExtension: (path: string) => Effect.Effect<void, SqlError.SqlError>
}

export const make = (
  options: SqliteClientConfig,
): Effect.Effect<SqliteClient, never, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function*() {
    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames ?
      Statement
        .defaultTransforms(
          options.transformResultNames,
        )
        .array :
      undefined

    const makeConnection = Effect.gen(function*() {
      const readonly = options.readonly === true
      const db = new Database(options.filename, {
        readonly,
        readwrite: readonly ? false : options.readwrite ?? true,
        create: readonly ? false : options.create ?? true,
      } as any)
      yield* Effect.addFinalizer(() => Effect.sync(() => db.close()))
      const busyTimeout = Math.min(
        MAX_BUSY_TIMEOUT,
        Math.max(0, Math.round(Duration.toMillis(options.busyTimeout ?? Duration.seconds(5)))),
      )
      db.run(`PRAGMA busy_timeout = ${busyTimeout};`)

      if (options.disableWAL !== true && !readonly) {
        db.run("PRAGMA journal_mode = WAL;")
      }

      const prepare = (sql: string, useSafeIntegers: boolean) => {
        const statement = db.query(sql)
        // @ts-ignore bun-types missing safeIntegers method, fixed in https://github.com/oven-sh/bun/pull/26627
        statement.safeIntegers(useSafeIntegers)
        return statement
      }

      const run = (
        sql: string,
        params: ReadonlyArray<unknown> = [],
      ) =>
        Effect.withFiber<Array<any>, SqlError.SqlError>((fiber) => {
          const useSafeIntegers = Context.get(fiber.context, Client.SafeIntegers)
          try {
            return Effect.succeed((prepare(sql, useSafeIntegers).all(...(params as any)) ?? []) as Array<any>)
          } catch (cause) {
            return Effect.fail(
              new SqlError.SqlError({ reason: classifyError(cause, "Failed to execute statement", "execute") }),
            )
          }
        })

      const runValues = (
        sql: string,
        params: ReadonlyArray<unknown> = [],
      ) =>
        Effect.withFiber<Array<any>, SqlError.SqlError>((fiber) => {
          const useSafeIntegers = Context.get(fiber.context, Client.SafeIntegers)
          try {
            return Effect.succeed((prepare(sql, useSafeIntegers).values(...(params as any)) ?? []) as Array<any>)
          } catch (cause) {
            return Effect.fail(
              new SqlError.SqlError({ reason: classifyError(cause, "Failed to execute statement", "executeValues") }),
            )
          }
        })

      return Function.identity<SqliteConnection>({
        execute(sql, params, transformRows) {
          return transformRows
            ? Effect.map(run(sql, params), transformRows)
            : run(sql, params)
        },
        executeRaw(sql, params) {
          return run(sql, params)
        },
        executeValues(sql, params) {
          return runValues(sql, params)
        },
        executeValuesUnprepared(sql, params) {
          return runValues(sql, params)
        },
        executeUnprepared(sql, params, transformRows) {
          return this.execute(sql, params, transformRows)
        },
        executeStream(_sql, _params) {
          return Stream.die("executeStream not implemented")
        },
        export: Effect.try({
          try: () => db.serialize(),
          catch: (cause) =>
            new SqlError.SqlError({ reason: classifyError(cause, "Failed to export database", "export") }),
        }),
        loadExtension: (path) =>
          Effect.try({
            try: () => db.loadExtension(path),
            catch: (cause) =>
              new SqlError.SqlError({ reason: classifyError(cause, "Failed to load extension", "loadExtension") }),
          }),
      })
    })

    const semaphore = yield* Semaphore.make(1)
    const connection = yield* makeConnection

    const acquirer = semaphore.withPermits(1)(Effect.succeed(connection))
    const transactionAcquirer = Effect.uninterruptibleMask((restore) => {
      const fiber = Fiber.getCurrent()!
      const scope = Context.getUnsafe(fiber.context, Scope.Scope)
      return Effect.as(
        Effect.tap(
          restore(semaphore.take(1)),
          () => Scope.addFinalizer(scope, semaphore.release(1)),
        ),
        connection,
      )
    })

    return Object.assign(
      (yield* Client.make({
        acquirer,
        compiler,
        transactionAcquirer,
        beginTransaction: "BEGIN IMMEDIATE",
        spanAttributes: [
          ...(options.spanAttributes ? Object.entries(options.spanAttributes) : []),
          [ATTR_DB_SYSTEM_NAME, "sqlite"],
        ],
        transformRows,
      })) as SqliteClient,
      {
        [TypeId]: TypeId as TypeId,
        config: options,
        export: Effect.flatMap(acquirer, (_) => _.export),
        loadExtension: (path: string) => Effect.flatMap(acquirer, (_) => _.loadExtension(path)),
      },
    )
  })

export const layerConfig = (
  config: Config.Wrap<SqliteClientConfig>,
): Layer.Layer<SqliteClient | Client.SqlClient, Config.ConfigError> =>
  Layer
    .effectContext(
      Config.unwrap(config).pipe(
        Effect.flatMap(make),
        Effect.map((client) =>
          Context.make(SqliteClient, client).pipe(
            Context.add(Client.SqlClient, client),
          )
        ),
      ),
    )
    .pipe(Layer.provide(Reactivity.layer))

export const layer = (
  config: SqliteClientConfig,
): Layer.Layer<SqliteClient | Client.SqlClient> =>
  Layer
    .effectContext(
      Effect.map(make(config), (client) =>
        Context.make(SqliteClient, client).pipe(
          Context.add(Client.SqlClient, client),
        )),
    )
    .pipe(Layer.provide(Reactivity.layer))
