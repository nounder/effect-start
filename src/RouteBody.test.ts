import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as RouteBody from "./RouteBody.ts"
import * as RouteMount from "./RouteMount.ts"

const text = RouteBody.build<string, "text">({
  format: "text",
})

test.it("infers parent descriptions", () => {
  RouteMount.get(
    text((ctx) =>
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
  text((ctx, next) =>
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
  text((ctx, next) =>
    Effect.gen(function*() {
      return 1337
    })
  )
})

test.it("accepts text stream", () => {
  RouteMount.get(
    text((ctx) =>
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
  const html = RouteBody.build<string, "html">({ format: "html" })

  RouteMount.get(
    html(function*() {
      return Stream.make("<div>", "content", "</div>")
    }),
  )
})

test.it("accepts Effect<Stream<Uint8Array>> for bytes format", () => {
  const bytes = RouteBody.build<Uint8Array, "bytes">({ format: "bytes" })
  const encoder = new TextEncoder()

  RouteMount.get(
    bytes(function*() {
      return Stream.make(encoder.encode("chunk"))
    }),
  )
})

test.it("rejects Stream for json format", () => {
  const json = RouteBody.build<{ msg: string }, "json">({ format: "json" })

  // @ts-expect-error Stream not allowed for json format
  json(function*() {
    return Stream.make({ msg: "hello" })
  })
})

test.it("accepts value directly", () => {
  const value = "Hello, world!"

  test
    .expectTypeOf(text)
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

    test
      .expect(result)
      .toBe("from effect")
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

    const result = await Effect.runPromise(
      handler({ id: 42 }, () => Effect.succeed(23)),
    )

    test
      .expect(result)
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
        [{ id: number }, () => Effect.Effect<number>]
      >()

    test
      .expectTypeOf(handler)
      .returns
      .toEqualTypeOf<
        Effect.Effect<number, never, never>
      >()

    const result = await Effect.runPromise(
      // TODO: we should accept Effect.void in next here
      handler({ id: 21 }, () => Effect.succeed(23)),
    )

    test
      .expect(result)
      .toBe(42)
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
