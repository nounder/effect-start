import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Endpoint from "./Endpoint.ts"

const ep = Endpoint.make({
  method: "POST",

  success: Schema.Struct({
    ok: Schema.Boolean,
  }),

  handle: Effect.succeed({
    ok: true,
  }),
})

type A = Endpoint.Endpoint.Method<typeof ep>
type S2 = Endpoint.Endpoint.Success<typeof ep>
type P = Endpoint.Endpoint.Path<typeof ep>
type P2 = typeof ep["path"]
