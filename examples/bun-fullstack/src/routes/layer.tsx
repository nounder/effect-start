import { Route } from "effect-start"
import * as Schema from "effect/Schema"

Route
  .schemaPathParams({
    id: Schema.String,
  })
  .html(function*(props) {
    return (
      <div>
        <h2>
          Layer Route with ID: {props.pathParams.id}
        </h2>
      </div>
    )
  })

export default Route.layer(
  Route.html(function*(props) {
    return (
      <html>
        <head>
          <title>
            {props.slots.title ?? "Default title"}
          </title>
        </head>
        <body>
          <h1>
            Root
          </h1>

          {props.children}
        </body>
      </html>
    )
  }),
)
