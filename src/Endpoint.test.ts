import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Endpoint from "./Endpoint"

export const HEAD = Endpoint
  .empty
  .addSuccess(
    Schema.Struct({
      id: Schema.UUID,
    }),
  )

// in this case i will have to pass Handler
// to verify it is compatible with success schema
// this will require overwriting HttpApiEndpoint generic
//
export const GET = Endpoint
  .handle(function*() {
    return 23
  })
  .addSuccess(
    Schema.Struct({
      id: Schema.UUID,
    }),
  )

const SampleModule = {
  GET: Endpoint.define({
    success: Schema.Struct({
      id: Schema.UUID,
    }),

    handler: Effect.gen(function*() {
      return {
        id: crypto.randomUUID(),
      }
    }),
  }),

  POST: Endpoint.define({
    success: Schema.Array(
      Schema.Struct({
        id: Schema.String,
      }),
    ),

    handler: Effect.gen(function*() {
      return [{
        id: "a",
      }]
    }),
  }),
}
