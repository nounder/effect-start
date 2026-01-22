import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Entity from "./Entity.ts"
import * as Route from "./Route.ts"
import * as RouteBody from "./RouteBody.ts"
import * as RouteMount from "./RouteMount.ts"

test.it("infers parent descriptions", () => {
  RouteMount.get(
    Route.text((ctx) =>
      Effect.gen(function*() {
        test
          .expectTypeOf(ctx)
          .toExtend<{
            method: "GET"
            format: "text"
          }>()

        return "Hello, world!"
      })
    ),
  )
})

test.it("next is function returning Entity", () => {
  Route.text((ctx, next) =>
    Effect.gen(function*() {
      test
        .expectTypeOf(next)
        .toExtend<() => Entity.Entity<string>>()

      return "Hello, world!"
    })
  )
})

test.it("enforces result value", () => {
  // @ts-expect-error must return string
  Route.text((ctx, next) =>
    Effect.gen(function*() {
      return 1337
    })
  )
})

test.it("accepts text stream", () => {
  RouteMount.get(
    Route.text((ctx) =>
      Effect.gen(function*() {
        test
          .expectTypeOf(ctx)
          .toExtend<{
            method: "GET"
            format: "text"
          }>()

        return Stream.make("Hello", " ", "world!")
      })
    ),
  )
})

test.it("accepts Effect<Stream<string>> for html format", () => {
  RouteMount.get(
    Route.html(function*() {
      return Stream.make("<div>", "content", "</div>")
    }),
  )
})

test.it("accepts Effect<Stream<Uint8Array>> for bytes format", () => {
  const encoder = new TextEncoder()

  RouteMount.get(
    Route.bytes(function*() {
      return Stream.make(encoder.encode("chunk"))
    }),
  )
})

test.it("rejects Stream for json format", () => {
  // @ts-expect-error Stream not allowed for json format
  Route.json(function*() {
    return Stream.make({ msg: "hello" })
  })
})

test.it("accepts value directly", () => {
  const value = "Hello, world!"

  test
    .expectTypeOf(Route.text)
    .toBeCallableWith(value)
})

test.describe(`${RouteBody.handle.name}()`, () => {
  const ctx = {}
  const next = () => Entity.effect(Effect.succeed(Entity.make("next")))

  test.it("accepts all HandlerInput variants", () => {
    test
      .expectTypeOf<
        RouteBody.HandlerInput<{ foo: string }, string, Error, never>
      >()
      .toExtend<Parameters<typeof RouteBody.handle>[0]>()
  })

  test.it("handles plain value", async () => {
    const handler = RouteBody.handle("hello")

    test
      .expectTypeOf(handler)
      .returns
      .toEqualTypeOf<
        Effect.Effect<Entity.Entity<string>, never, never>
      >()

    const result = await Effect.runPromise(handler(ctx, next))
    test.expect(result.body).toBe("hello")
    test.expect(result.status).toBe(200)
  })

  test.it("handles Effect directly", async () => {
    const handler = RouteBody.handle(Effect.succeed("from effect"))

    test
      .expectTypeOf(handler)
      .returns
      .toEqualTypeOf<
        Effect.Effect<Entity.Entity<string>, never, never>
      >()

    const result = await Effect.runPromise(handler(ctx, next))

    test
      .expect(result.body)
      .toBe("from effect")
  })

  test.it("handles Effect with error", async () => {
    const handler = RouteBody.handle(Effect.fail(new Error("oops")))

    test
      .expectTypeOf(handler)
      .returns
      .toEqualTypeOf<
        Effect.Effect<Entity.Entity<never>, Error, never>
      >()
  })

  test.it("handles function", async () => {
    const handler = RouteBody.handle(
      (ctx: { id: number }) => Effect.succeed(ctx.id),
    )

    test
      .expectTypeOf(handler)
      .parameters
      .toEqualTypeOf<
        [
          { id: number },
          (
            context?: Partial<{ id: number }> & Record<string, unknown>,
          ) => Entity.Entity<number>,
        ]
      >()
    test
      .expectTypeOf(handler)
      .returns
      .toEqualTypeOf<
        Effect.Effect<Entity.Entity<number>, never, never>
      >()

    const numNext = () => Entity.effect(Effect.succeed(Entity.make(23)))
    const result = await Effect.runPromise(
      handler({ id: 42 }, numNext),
    )

    test
      .expect(result.body)
      .toBe(42)
  })

  test.it("handles generator", async () => {
    const handler = RouteBody.handle(function*(ctx: { id: number }) {
      const n = yield* Effect.succeed(ctx.id)
      return n * 2
    })

    test
      .expectTypeOf(handler)
      .parameters
      .toEqualTypeOf<
        [
          { id: number },
          (
            context?: Partial<{ id: number }> & Record<string, unknown>,
          ) => Entity.Entity<number>,
        ]
      >()

    test
      .expectTypeOf(handler)
      .returns
      .toEqualTypeOf<
        Effect.Effect<Entity.Entity<number>, never, never>
      >()

    const numNext = () => Entity.effect(Effect.succeed(Entity.make(23)))
    const result = await Effect.runPromise(
      handler({ id: 21 }, numNext),
    )

    test
      .expect(result.body)
      .toBe(42)
  })

  test.it("generator can call next", async () => {
    const handler = RouteBody.handle(
      function*(_ctx: {}, next: () => Entity.Entity<string>) {
        const fromNext = yield* next().text
        return `got: ${fromNext}`
      },
    )

    const result = await Effect.runPromise(handler(ctx, next))

    test
      .expect(result.body)
      .toBe("got: next")
  })
})
