import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as test from "bun:test"
import {
  Effect,
  Schema,
} from "effect"
import * as Action from "./Action.ts"

test.it("filter", () => {
  const action = Action.empty.pipe(
    Action.filter(() =>
      Effect.succeed({
        context: {
          filtered: true,
        },
      })
    ),
    Action.text(context =>
      Effect.succeed(
        `Filtered: ${context.filtered}`,
      )
    ),
  )
})

test.it("schemaHeaders", () => {
  const schemaHeaders = Schema.Struct({
    "origin": Schema.String,
  })
  const headers = {
    "origin": "nounder.org",
  }
  type ExpectedBindings = {
    headers: typeof headers
  }

  const withFilter = Action.empty.pipe(
    Action.filter(() =>
      Effect.succeed({
        context: {
          headers,
        },
      })
    ),
    Action.text(context => {
      test
        .expectTypeOf(context)
        .toExtend<ExpectedBindings>()

      return Effect.succeed(
        `Origin: ${context.headers.origin}`,
      )
    }),
  )

  const withSchema = Action.empty.pipe(
    Action.schemaHeaders(schemaHeaders),
    Action.text(context => {
      test
        .expectTypeOf(context)
        .toExtend<ExpectedBindings>()

      return Effect.succeed(
        `Origin: ${context.headers.origin}`,
      )
    }),
  )
})

test.it("infers schema", async () => {
  test.expect.assertions(2)

  const schemaHeaders = Schema.Struct({
    "x-hello": Schema.String,
  })
  const headers = {
    "x-hello": "test-value",
  }
  type ExpectedBindings = {
    headers: typeof headers
  }

  const schemaAction = Action.empty.pipe(
    Action.schemaHeaders(schemaHeaders),
  )

  const action = Action.empty.pipe(
    Action.filter(() =>
      Effect.gen(function*() {
        const headers = yield* HttpServerRequest.schemaHeaders(
          Schema.Struct({
            "x-hello": Schema.String,
          }),
        )

        return {
          context: {
            headers,
          },
        }
      })
    ),
    Action.text((context) =>
      Effect.gen(function*() {
        test
          .expectTypeOf(context)
          .toExtend<ExpectedBindings>()

        test
          .expect(context)
          .toMatchObject({
            headers,
          })

        return "Hello, World!"
      })
    ),
  )

  test
    .expectTypeOf(action)
    // TODO
    .toExtend<any>()
  test
    .expectTypeOf<Action.Action.Bindings<typeof action>>()
    .toExtend<ExpectedBindings>()

  const result = await runAction(action, {
    headers,
  })

  test
    .expect(result)
    .toBe("Hello, World!")
})

test.it("uses GET method", async () => {
  test.expect.assertions(2)

  type ExpectedBindings = {
    method: "GET"
  }

  const action = Action.get(
    Action.text((context) =>
      Effect.gen(function*() {
        test
          .expectTypeOf(context)
          .toExtend<ExpectedBindings>()
        test
          .expect(context)
          .toMatchObject({
            method: "GET",
          })

        return "Hello, World!"
      })
    ),
  )

  test
    .expectTypeOf(action)
    .toExtend<
      Action.ActionSet.ActionSet<[
        Action.Action.Action<
          Action.ActionHandler<void, never, never>,
          ExpectedBindings
        >,
        Action.Action.Action<
          Action.ActionHandler<string, never, never>,
          ExpectedBindings
        >,
      ]>
    >()
  test
    .expectTypeOf<Action.Action.Bindings<typeof action>>()
    .toExtend<ExpectedBindings>()

  const result = await runAction(action, {
    method: "GET",
  })

  test
    .expect(result)
    .toBe("Hello, World!")
})

test.it("uses GET & POST method", async () => {
  test.expect.assertions(1)

  type ExpectedBindings = {
    method: "GET" | "POST"
  }

  const action = Action
    .get(
      Action.text((action) => {
        test
          .expectTypeOf(action.method)
          .toEqualTypeOf<"GET">()

        return Effect.succeed("get")
      }),
    )
    .post(
      Action.text((action) => {
        test
          .expectTypeOf(action.method)
          .toEqualTypeOf<"POST">()

        return Effect.succeed("post")
      }),
    )

  test
    .expectTypeOf<Action.Action.Bindings<typeof action>>()
    .toExtend<ExpectedBindings>()

  const allActions = [...action]
  test.expect(allActions.length).toBe(4)
})

function runAction(
  actionSet: Action.ActionSet.Any,
  bindings: unknown,
) {
  const actions = [...actionSet]
  const action = actions[actions.length - 1]
  return Effect.runPromise(
    action.handler(bindings) as Effect.Effect<unknown>,
  )
}
