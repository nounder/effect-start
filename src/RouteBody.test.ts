import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import type * as ParseResult from "effect/ParseResult"
import * as Stream from "effect/Stream"
import * as Entity from "./Entity.ts"
import * as Route from "./Route.ts"
import * as RouteBody from "./RouteBody.ts"
import * as RouteMount from "./RouteMount.ts"

test.it("infers parent descriptions", () => {
  RouteMount.get(
    Route.text((ctx) =>
      Effect.gen(function* () {
        test.expectTypeOf(ctx).toExtend<{
          method: "GET"
          format: "text"
        }>()

        return "Hello, world!"
      }),
    ),
  )
})

test.it("next is function returning Entity", () => {
  Route.text((ctx, next) =>
    Effect.gen(function* () {
      test.expectTypeOf(next).toExtend<() => Entity.Entity<string>>()

      return "Hello, world!"
    }),
  )
})

test.it("enforces result value", () => {
  // @ts-expect-error must return string
  Route.text((ctx, next) =>
    Effect.gen(function* () {
      return 1337
    }),
  )
})

test.it("accepts text stream", () => {
  RouteMount.get(
    Route.text((ctx) =>
      Effect.gen(function* () {
        test.expectTypeOf(ctx).toExtend<{
          method: "GET"
          format: "text"
        }>()

        return Stream.make("Hello", " ", "world!")
      }),
    ),
  )
})

test.it("accepts Effect<Stream<string>> for html format", () => {
  RouteMount.get(
    Route.html(function* () {
      return Stream.make("<div>", "content", "</div>")
    }),
  )
})

test.it("accepts Effect<Stream<Uint8Array>> for bytes format", () => {
  const encoder = new TextEncoder()

  RouteMount.get(
    Route.bytes(function* () {
      return Stream.make(encoder.encode("chunk"))
    }),
  )
})

test.it("rejects Stream for json format", () => {
  // @ts-expect-error Stream not allowed for json format
  Route.json(function* () {
    return Stream.make({ msg: "hello" })
  })
})

test.it("accepts value directly", () => {
  const value = "Hello, world!"

  test.expectTypeOf(Route.text).toBeCallableWith(value)
})

test.describe(`${RouteBody.handle.name}()`, () => {
  const ctx = {}
  const next = () => Entity.effect(Effect.succeed(Entity.make("next")))

  test.it("accepts all HandlerInput variants", () => {
    test
      .expectTypeOf<RouteBody.HandlerInput<{ foo: string }, string, Error, never>>()
      .toExtend<Parameters<typeof RouteBody.handle>[0]>()
  })

  test.it("handles plain value", () =>
    Effect.gen(function* () {
      const handler = RouteBody.handle<{}, string, never, never>("hello")
      const result = yield* handler(ctx, next)

      test.expect(result.body).toBe("hello")
      test.expect(result.status).toBe(200)
    }).pipe(Effect.runPromise),
  )

  test.it("handles Effect directly", () =>
    Effect.gen(function* () {
      const handler = RouteBody.handle<{}, string, never, never>(Effect.succeed("from effect"))
      const result = yield* handler(ctx, next)

      test.expect(result.body).toBe("from effect")
    }).pipe(Effect.runPromise),
  )

  test.it("handles Effect with error", async () => {
    const handler = RouteBody.handle<{}, never, Error, never>(Effect.fail(new Error("oops")))

    test.expectTypeOf(handler).returns.toExtend<Effect.Effect<Entity.Entity<never>, Error, never>>()
  })

  test.it("handles function", () =>
    Effect.gen(function* () {
      const handler = RouteBody.handle<{ id: number }, number, never, never>((ctx) =>
        Effect.succeed(ctx.id),
      )

      test
        .expectTypeOf(handler)
        .parameters.toEqualTypeOf<
          [
            { id: number },
            (context?: Partial<{ id: number }> & Record<string, unknown>) => Entity.Entity<number>,
          ]
        >()
      test
        .expectTypeOf(handler)
        .returns.toEqualTypeOf<Effect.Effect<Entity.Entity<number>, never, never>>()

      const numNext = () => Entity.effect(Effect.succeed(Entity.make(23)))
      const result = yield* handler({ id: 42 }, numNext)

      test.expect(result.body).toBe(42)
    }).pipe(Effect.runPromise),
  )

  test.it("handles generator", () =>
    Effect.gen(function* () {
      const handler = RouteBody.handle<{ id: number }, number, never, never>(function* (ctx) {
        const n = yield* Effect.succeed(ctx.id)
        return n * 2
      })

      test
        .expectTypeOf(handler)
        .parameters.toEqualTypeOf<
          [
            { id: number },
            (context?: Partial<{ id: number }> & Record<string, unknown>) => Entity.Entity<number>,
          ]
        >()

      test
        .expectTypeOf(handler)
        .returns.toEqualTypeOf<Effect.Effect<Entity.Entity<number>, never, never>>()

      const numNext = () => Entity.effect(Effect.succeed(Entity.make(23)))
      const result = yield* handler({ id: 21 }, numNext)

      test.expect(result.body).toBe(42)
    }).pipe(Effect.runPromise),
  )

  test.it("generator can call next", () =>
    Effect.gen(function* () {
      const handler = RouteBody.handle<{}, string, ParseResult.ParseError, never>(
        function* (_ctx, next) {
          const fromNext = yield* next().text
          return `got: ${fromNext}`
        },
      )

      const result = yield* Effect.orDie(handler(ctx, next))

      test.expect(result.body).toBe("got: next")
    }).pipe(Effect.runPromise),
  )

  test.it("generator type checks missing services", async () => {
    interface ServiceA {
      readonly _: unique symbol
    }
    const ServiceA = Context.GenericTag<ServiceA>("ServiceA")

    const handler = RouteBody.handle(function* () {
      yield* ServiceA
      return "ok"
    })

    // This should fail type checking because ServiceA is not provided
    // @ts-expect-error ServiceA is missing
    const promise = Effect.runPromise(handler(ctx, next))

    test.expect(promise).rejects.toThrow(/Service not found: ServiceA/)
  })

  test.it("generator infers error type from yielded effects", () => {
    class CustomError extends Data.TaggedError("CustomError")<{}> {}

    const handler = RouteBody.handle(function* () {
      yield* Effect.fail(new CustomError())
      return "ok"
    })

    test
      .expectTypeOf(handler)
      .returns.toExtend<Effect.Effect<Entity.Entity<string>, CustomError, never>>()
  })

  test.it("Route.text infers error type from yielded effects", () => {
    class MyError extends Data.TaggedError("MyError")<{}> {}

    const routes = RouteMount.get(
      Route.text(function* () {
        yield* Effect.fail(new MyError())
        return "error occurred"
      }),
    )

    type Items = typeof routes extends Route.RouteSet.RouteSet<any, any, infer I> ? I : never

    test
      .expectTypeOf<Items[0]>()
      .toExtend<
        Route.Route.Route<{ method: "GET"; format: "text" }, {}, "error occurred", MyError, never>
      >()
  })
})
