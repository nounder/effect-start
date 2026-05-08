import * as test from "bun:test"
import type { BunServer } from "effect-start/bun"
import * as Start from "effect-start/Start"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as StartApp from "../src/internal/StartApp.ts"

// Start.build and Start.pack are thin wrappers over LayerExtra.provideMergeAll
// and LayerExtra.buildUnordered (see test/internal/LayerExtra.test.ts for
// runtime behavior coverage). The tests here only validate the parts that
// differ from the underlying functions: the re-declared signatures.

test.describe(Start.build, () => {
  test.test("type signature: rejects wrong layer ordering", () => {
    // @ts-expect-error LoggerLive first means DatabaseLive can't find Logger
    Start.build(LoggerLive, DatabaseLive, UserRepoLive)

    // @ts-expect-error DatabaseLive before LoggerLive, UserRepoLive last but needs Database
    Start.build(DatabaseLive, LoggerLive, UserRepoLive)
  })

  test.test("type signature: surfaces unsatisfied dependencies on R", () => {
    const AppLayer = Start.build(UserRepoLive, DatabaseLive, LoggerLive)

    test
      .expectTypeOf<Layer.Layer.Context<typeof AppLayer>>()
      .toEqualTypeOf<
        ExternalApi
      >()
  })

  test.test("smoke: produces a working layer", () => {
    const AppLayer = Start.build(UserRepoLive, DatabaseLive, LoggerLive)
    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })

    return Effect
      .gen(function*() {
        const userRepo = yield* UserRepo
        const result = yield* userRepo.findUser("123")

        test
          .expect(result)
          .toEqual({ rows: [] })
      })
      .pipe(
        Effect.provide(AppLayer),
        Effect.provide(ExternalApiLive),
        Effect.runPromise,
      )
  })
})

test.describe(Start.pack, () => {
  test.test("type signature: rejects unsatisfied dependencies", () => {
    // @ts-expect-error UserRepoLive needs ExternalApi which no layer provides
    Start.pack(LoggerLive, DatabaseLive, UserRepoLive)
  })

  test.test("type signature: error scopes to the argument with the missing dep", () => {
    Start.pack(
      LoggerLive,
      DatabaseLive,
      // @ts-expect-error only this argument should be flagged — its R has unsatisfied ExternalApi
      UserRepoLive,
    )
  })

  test.test("type signature: a layer with no missing deps is not flagged", () => {
    // DatabaseLive needs Logger which IS provided, so it should not error here.
    // UserRepoLive needs ExternalApi which is NOT provided, so it errors instead.
    Start.pack(
      LoggerLive,
      DatabaseLive,
      // @ts-expect-error UserRepoLive is the only arg with an unsatisfied dep
      UserRepoLive,
    )
  })

  test.test("type signature: returns Layer with R = never when fully satisfied", () => {
    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })
    const AppLayer = Start.pack(
      LoggerLive,
      DatabaseLive,
      UserRepoLive,
      ExternalApiLive,
    )

    test
      .expectTypeOf<Layer.Layer.Context<typeof AppLayer>>()
      .toEqualTypeOf<
        never
      >()
  })

  test.test("type signature: a layer with partial satisfaction is still flagged", () => {
    // PartialNeedsLive needs Logger (satisfied) AND ExternalApi (unsatisfied) —
    // the error should still flag this argument.
    const PartialNeedsLive = Layer.effect(
      UserRepo,
      Effect.gen(function*() {
        yield* Logger
        yield* ExternalApi
        return { findUser: () => Effect.succeed(null) }
      }),
    )
    Start.pack(
      LoggerLive,
      // @ts-expect-error ExternalApi unsatisfied; Logger is satisfied and should not appear in the error
      PartialNeedsLive,
    )
  })

  test.test("smoke: produces a working layer regardless of order", () => {
    const ExternalApiLive = Layer.succeed(ExternalApi, {
      call: () => Effect.void,
    })
    const AppLayer = Start.pack(
      LoggerLive,
      DatabaseLive,
      UserRepoLive,
      ExternalApiLive,
    )

    return Effect
      .gen(function*() {
        const userRepo = yield* UserRepo
        const result = yield* userRepo.findUser("123")

        test
          .expect(result)
          .toEqual({ rows: [] })
      })
      .pipe(
        Effect.provide(AppLayer),
        Effect.runPromise,
      )
  })
})

test.describe("StartApp.server", () => {
  test.test("waits for server ready deferred in StartApp", () =>
    Effect
      .gen(function*() {
        const deferred = yield* Deferred.make<BunServer.BunServer>()

        const fakeServer = {
          server: { port: 1234 } as any,
          pushHandler: (
            _fetch: Parameters<BunServer.BunServer["pushHandler"]>[0],
          ) => {},
          popHandler: () => {},
          setRoutes: () => Effect.void,
        } satisfies BunServer.BunServer

        const resultFiber = yield* Effect
          .gen(function*() {
            const app = yield* StartApp.StartApp
            return yield* Deferred.await(app.server)
          })
          .pipe(
            Effect.provide(
              Layer.succeed(StartApp.StartApp, { server: deferred }),
            ),
            Effect.fork,
          )

        yield* Deferred.succeed(deferred, fakeServer)
        const result = yield* Fiber.join(resultFiber)

        test
          .expect(result)
          .toBe(fakeServer)
      })
      .pipe(Effect.runPromise))
})

class Logger extends Context.Tag("Logger")<
  Logger,
  { log: (msg: string) => Effect.Effect<void> }
>() {}
class Database extends Context.Tag("Database")<
  Database,
  { query: (sql: string) => Effect.Effect<unknown> }
>() {}
class UserRepo extends Context.Tag("UserRepo")<
  UserRepo,
  { findUser: (id: string) => Effect.Effect<unknown> }
>() {}
class ExternalApi extends Context.Tag("ExternalApi")<
  ExternalApi,
  { call: () => Effect.Effect<void> }
>() {}

const LoggerLive = Layer.succeed(Logger, { log: (msg) => Effect.log(msg) })

const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function*() {
    const logger = yield* Logger
    yield* logger.log("Connecting to database...")
    return { query: (_sql) => Effect.succeed({ rows: [] }) }
  }),
)

const UserRepoLive = Layer.effect(
  UserRepo,
  Effect.gen(function*() {
    const db = yield* Database
    const logger = yield* Logger
    const api = yield* ExternalApi
    yield* logger.log("UserRepo initialized")
    yield* api.call()
    return {
      findUser: (id) => db.query(`SELECT * FROM users WHERE id = ${id}`),
    }
  }),
)
