import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Endpoint from "./Endpoint.ts"

const ep = Endpoint.make({
  method: "GET" as const,

  success: Schema.Struct({
    ok: Schema.Boolean,
  }),

  handle: Effect.succeed({
    ok: true,
  }),
})

type A = Endpoint.Endpoint.Method<typeof ep>
