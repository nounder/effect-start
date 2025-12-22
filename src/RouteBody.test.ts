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
  RouteBody.text((ctx, next) =>
    // @ts-expect-error must return string
    Effect.gen(function*() {
      return 1337
    })
  )
})
