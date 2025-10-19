import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Schema from "effect/Schema"
import * as Route from "./Route.ts"

const schemaUrlParams = Schema.Struct({
  id: Schema.String,
})

const schemaSuccess = Schema.Struct({
  username: Schema.String,
})

test.it("creates a data route", () => {
  const route = Function.pipe(
    Route.empty,
    Route.schema({
      pathParams: Schema.String,
      headers: Schema.String,
      success: schemaSuccess,
      urlParams: schemaUrlParams,
    }),
  )

  test.expect(route.schema.pathParams)
    .toBe(Schema.String)

  test.expect(route.schema.headers)
    .toBe(Schema.String)

  test.expect(route.schema.success)
    .toBe(schemaSuccess)

  test.expect(route.schema.urlParams)
    .toBe(schemaUrlParams)

  test.expect(route.variants.length)
    .toBe(0)
})
