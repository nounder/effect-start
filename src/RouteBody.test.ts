import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as RouteBody from "./RouteBody.ts"
import * as RouteMethod from "./RouteMethod.ts"

test.it("infers parent descriptions", () => {
  RouteMethod.get(
    RouteBody.text((ctx) =>
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

test.it("cannot modify context", () => {
  RouteBody.text((ctx, next) =>
    Effect.gen(function*() {
      test
        .expectTypeOf(next)
        .parameters
        .toEqualTypeOf<[]>()

      return "Hello, world!"
    })
  )
})

test.it("enforces result value", () => {
  // @ts-expect-error must return string
  RouteBody.text((ctx, next) =>
    Effect.gen(function*() {
      return 1337
    })
  )
})

test.it("accepts value directly", () => {
  const value = "Hello, world!"

  test
    .expectTypeOf(RouteBody.text)
    .toBeCallableWith(value)
})

test.describe(`${RouteBody.handle.name}()`, () => {
  const ctx = {}
  const next = () => Effect.succeed("next" as const)

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
        Effect.Effect<string, never, never>
      >()

    const result = await Effect.runPromise(handler(ctx, next))
    test.expect(result).toBe("hello")
  })

  test.it("handles Effect directly", async () => {
    const handler = RouteBody.handle(Effect.succeed("from effect"))

    test
      .expectTypeOf(handler)
      .returns
      .toEqualTypeOf<
        Effect.Effect<string, never, never>
      >()

    const result = await Effect.runPromise(handler(ctx, next))
    test.expect(result).toBe("from effect")
  })

  test.it("handles Effect with error", async () => {
    const handler = RouteBody.handle(Effect.fail(new Error("oops")))

    test
      .expectTypeOf(handler)
      .returns
      .toEqualTypeOf<
        Effect.Effect<never, Error, never>
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
        [{ id: number }, () => Effect.Effect<number>]
      >()
    test
      .expectTypeOf(handler)
      .returns
      .toEqualTypeOf<
        Effect.Effect<number, never, never>
      >()

    const result = await Effect.runPromise(handler({ id: 42 }, next))
    test.expect(result).toBe(42)
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
        [{ id: number }, () => Effect.Effect<number>]
      >()

    test
      .expectTypeOf(handler)
      .returns
      .toEqualTypeOf<
        Effect.Effect<number, never, never>
      >()

    const result = await Effect.runPromise(handler({ id: 21 }, next))
    test.expect(result).toBe(42)
  })

  test.it("generator can call next", async () => {
    const handler = RouteBody.handle(
      function*(_ctx: {}, next: () => Effect.Effect<string>) {
        const fromNext = yield* next()
        return `got: ${fromNext}`
      },
    )

    const result = await Effect.runPromise(handler(ctx, next))

    test
      .expect(result)
      .toBe("got: next")
  })
})
