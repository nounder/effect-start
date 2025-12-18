import * as test from "bun:test"
import {
  Effect,
  Schema,
} from "effect"
import * as Action from "./Action.ts"

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
  const action = Action.empty.pipe(
    // we also need to annotate at runtime (for docs, etc.)
    Action.schemaHeaders(schemaHeaders),
    Action.text((action) =>
      Effect.gen(function*() {
        test
          .expectTypeOf(action)
          .toExtend<ExpectedBindings>()

        test
          .expect(action)
          .toMatchObject({
            headers,
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
    Action.text((action) =>
      Effect.gen(function*() {
        test
          .expectTypeOf(action)
          .toExtend<ExpectedBindings>()
        test
          .expect(action)
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
