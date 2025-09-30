import { Schema } from "effect"
import * as Route from "effect-start/Route"
import { Routes } from "routes"

export default Route
  .make<Routes, "/events">({
    schemaPathParams: Schema.Struct({
      id: Schema.String,
    }),
    schemaUrlParams: Schema.Struct({
      filter: Schema.String,
    }),
    *handler(ctx) {
      ctx.pathParams

      return (
        <div>
          Whoah!
        </div>
      )
    },
  })

Route
  .schema({
    pathParams: {
      id: Schema.String,
    },
  })
  // allows to query for json
  .data(ctx =>
    Db
      .from("users")
      .select()
      .where({
        id: ctx.path.id,
      })
      .first()
  )
  .text(ctx => {
    return `Username ${ctx.data.username}`
  })
  .page(ctx => {
    return (
      <div>
        {ctx.data.username}
      </div>
    )
  })

Route
  .schema({
    urlParams: {
      id: Schema.String,
    },
    success: {
      name: Schema.String,
    },
  })
  .data(ctx => Db.from("users").where({ id: ctx.urlParams.id }).first())
  .page(ctx =>
    html`
<div>users</div>
<div>name: ${ctx.data.username}</div>
`
  )
  .text(ctx => `name: ${ctx.data.username}`)

Route.pipe(
  Route.empty,
  Route
    .schema({
      pathParams: Schema.Struct({
        id: Schema.String,
      }),
      urlParams: Schema.Struct({
        filter: Schema.String,
      }),
    }),
  Route.get(function*(ctx) {
    ctx.pathParams

    return (
      <div>
        Whoah!
      </div>
    )
  }),
  Route.post(function*() {
  }),
)
