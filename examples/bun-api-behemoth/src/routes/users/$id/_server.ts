import * as Route from "effect-start/Route"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export const GET = Route.make({
  pathParams: Schema.Struct({
    id: Schema.String,
  }),

  handler: (req) =>
    Effect.succeed({
      id: req.path.id,
    }),
})

export const PUT = Route.make({
  pathParams: Schema.Struct({
    id: Schema.String,
  }),

  handler: (req) =>
    Effect.succeed({
      ok: true,
    }),
})

export const DELETE = Route.make({
  pathParams: Schema.Struct({
    id: Schema.String,
  }),

  handler: (req) =>
    Effect.succeed({
      ok: true,
    }),
})
