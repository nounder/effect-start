import * as test from "bun:test"
import {
  Effect,
  Schema,
} from "effect"
import * as Action from "./Action.ts"

test.describe(`${Action.filter.name}()`, () => {
  test.it("passes bindings", () => {
    const headers = {
      "origin": "nounder.org",
    }
    const filterResult = {
      context: {
        headers,
      },
    }

    const actions = Action.empty.pipe(
      Action.filter(() => Effect.succeed(filterResult)),
      Action.text(context => {
        test
          .expectTypeOf(context)
          .toExtend<typeof filterResult.context>()

        return Effect.succeed(
          `Origin: ${context.headers.origin}`,
        )
      }),
    )

    test
      .expectTypeOf(actions)
      .toExtend<
        Action.ActionSet.ActionSet<{}, [
          Action.Action.Action<
            {},
            typeof filterResult.context,
            any,
            never,
            never
          >,
          Action.Action.Action<
            { media: "text/plain" },
            typeof filterResult.context,
            string,
            never,
            never
          >,
        ]>
      >()

    test
      .expectTypeOf<Action.ActionSet.Descriptors<typeof actions>>()
      .toMatchObjectType<{ media: "text/plain" }>()

    test.expect(Action.items(actions)).toHaveLength(2)
  })
})

test.describe(`${Action.schemaHeaders.name}()`, () => {
  test.it("passes bindings and parses value", async () => {
    test.expect.assertions(2)

    const headers = {
      "x-hello": "test-value",
    }
    type ExpectedBindings = {
      headers: typeof headers
    }

    const action = Action.get(
      Action.schemaHeaders(
        Schema.Struct({
          "x-hello": Schema.String,
        }),
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
      .expectTypeOf<Action.Action.Bindings<typeof action>>()
      .toExtend<ExpectedBindings>()

    const result = await runAction(action, {
      headers,
    })

    test
      .expect(result)
      .toBe("Hello, World!")
  })
})

test.it("uses GET method", async () => {
  test.expect.assertions(2)

  const action = Action.get(
    Action.text((context) =>
      Effect.gen(function*() {
        test
          .expectTypeOf(context)
          .toMatchObjectType<{
            method: "GET"
            media: "text/plain"
          }>()
        test
          .expect(context)
          .toEqual({
            method: "GET",
            media: "text/plain",
          })

        return "Hello, World!"
      })
    ),
  )

  test
    .expectTypeOf(action)
    .toExtend<
      Action.ActionSet.ActionSet<{}, [
        Action.ActionSet.ActionSet<{
          method: "GET"
        }, [
          Action.Action.Action<
            {
              media: "text/plain"
            },
            {},
            string,
            never,
            never
          >,
        ]>,
      ]>
    >()

  test
    .expectTypeOf<Action.Action.Bindings<typeof action>>()
    .toMatchObjectType<{
      method: "GET"
      media: "text/plain"
    }>()

  const result = await runAction(action, {
    method: "GET",
    media: "text/plain",
  })

  test
    .expect(result)
    .toBe("Hello, World!")
})

test.it("uses GET & POST method", async () => {
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

  test.expect(Action.items(action)).toHaveLength(2)
})

test.describe(`${Action.get.name}()`, () => {
  test.it("accepts many media handlers", () => {
    const methodActions = Action
      .get(
        Action.text(() => Effect.succeed("get 1")),
      )
      .post(
        Action.text(() => Effect.succeed("get 1")),
      )

    test.expect(Action.items(methodActions)).toHaveLength(2)
  })
})

function runAction(
  actionSet: Action.ActionSet.Any,
  bindings: Record<string, any>,
) {
  const actions = [...actionSet]
  const action = actions[actions.length - 1]

  return Effect.runPromise(
    action.handler(bindings, () => Effect.void) as Effect.Effect<unknown>,
  )
}
