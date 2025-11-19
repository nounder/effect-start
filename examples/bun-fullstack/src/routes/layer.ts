import {
  Bundle,
  html,
  Route,
} from "effect-start"
import ClientCss from "../client.css" with { type: "file" }

export default Route.layer(
  Route.layout(function*() {
    const route = yield* Route.Route
    const bundle = yield* Bundle.ClientBundle
    const title = Route.slots.unsafeGet("title") ?? "Default title"
    const cssUrl = "/_bundle/" + bundle.resolve(ClientCss)
    const scriptTag = route.clientModuleUrl
      ? `<script type="module" src="${bundle.resolve(route.clientModuleUrl)}"></script>`
      : ""

    return `
      <html>
        <head>
          <title>${title}</title>
        </head>
        <body>
          Hello HTML!
          <link rel="stylesheet" href="${cssUrl}" />
          ${scriptTag}
        </body>
      </html>
    `
  }),
)
