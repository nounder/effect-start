import {
  Bundle,
  html,
  Route,
} from "effect-start"
import ClientCss from "../client.css" with { type: "file" }

export default Route.layer(
  Route.layout(function*() {
    const route = yield* Route.Route
    const bundle = yield* Bundle.Client

    return (
      <html>
        <head>
          <title>
            {Route.slots.unsafeGet("title") ?? "Default title"}
          </title>
        </head>
        <body>
          Hello HTML!

          <link
            rel="stylesheet"
            href={"/_bundle/" + bundle.resolve(ClientCss)}
          />
          {route.clientModuleUrl
            && (
              <script
                type="module"
                src={bundle.resolve(route.clientModuleUrl)}
              />
            )}
        </body>
      </html>
    )
  }),
)
