import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schedule from "effect/Schedule"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Route from "./Route.ts"

const schemaUrlParams = Schema.Struct({
  id: Schema.String,
})

const schemaSuccess = Schema.Struct({
  username: Schema.String,
})

test.it("creates a JSON route", () => {
  const metaRoute = Function.pipe(
    Route.empty,
    // route should provide Route.Request
    // View.Visit

    Route.schema({
      pathParams: Schema.Struct({}),
    }),
  )
  Route.json(Effect.succeed({ username: "test" }))

  Function.pipe(
    Route.empty,
    Route.schema({
      payload: Schema.Struct({
        name: Schema.String,
      }),
    }),

    Route.json(
      Effect.succeed({
        username: "test",
      }),
    ),
    Route.page(function*() {
      const data = yield* Route.json
      const payload = yield* Route.payload.option

      return html`
<form method=post>
  <input type=text name=name value=${data} />
  
  <button type=submit>Submit</button>
</form>

`
    }),
    // render the post even though payload schema fails
    Route.post(
      Function.pipe(
        Route.empty,
        Route.schema({
          payload: Schema.Struct({
            name: Schema.String,
          }),
        }),
        // blank page() uses Route.PageRoute requirement
        // which adds RouteVariant that is required by
        // Route.page
        // Route.page either accepts an Effect
        // or a Route with Route.PageRoute requirement
        Route.page(),
        Route.catchTag("PayloadError", () => Route.page()),
      ),
    ),
    // the above can be consolidated to
    Route.pageForm(function*(form) {
      const { payload, validation, errors } = form

      return html`
<form method=post>
  ${
        errors.name
        && `<div class=error>${errors.name.message}</div>`
      }

  <input type=text name=name value=${payload.name} />
  
  <button type=submit>Submit</button>
</form>
`
    }),
    Route.put(
      Function.pipe(
        Route.empty,
        Route.schema({
          payload: Schema.Struct({
            isActive: Schema.Boolean,
          }),
        }),
        Route.json(function*() {
          const payload = yield* Route.payload

          return {
            ok: true,
          }
        }),
      ),
    ),
    Route.delete(
      Function.pipe(
        Route.empty,
        Route.json(function*() {
          return {
            ok: true,
          }
        }),
        Route.check(Effect.gen(function* () {
          const params = yield* Route.params
          const user = yield* SignedUser.required
          const item = yield* db.item.find(params.id)

          return item && item.ownerId === user.id
        }))
        // html() detects its a route
        // and takes it and narrows it down to a parent route
        // in this case delete
        Route.html(
          // it has a variant for any method and path
          // but see above
          Route.redirect("/"),
        ),
      ),
    ),
    Route.sse(function*() {
      const lastReq = yield* Route.SessionRequest

      const eventStream = getEvents({
        startTime: lastReq.timestamp,
      })

      // update whole view on change
      const events = onTouch().pipe(
        Stream.map(Datastar.patch(() => Route.page)),
      )

      return Stream.repeat(
        Schedule.spaced("1 second"),
      )
    }),
    Route.provide(Sse.layer({
      heartbeatInterval: "10 seconds",
    })),
  )

  test.expect(route).toMatchObject({
    schema: {
      UrlParams: schemaUrlParams,
      Success: schemaSuccess,
    },
    variants: [
      {
        method: "GET",
        type: "application/json",
      },
    ],
  })
})
