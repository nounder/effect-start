import { Context, Effect, Layer, PubSub, Ref, Schema, Stream } from "effect"
import { Start, Route, Html, Bundle } from "effect-start"
import { BunBundle } from "effect-start/bun"
import { TailwindPlugin } from "effect-start/tailwind"

const routes = Route.tree({
  "*": Route.use(
    Route.html(function* (_ctx, next) {
      const bundle = yield* Bundle.ClientBundle

      return (
        <html>
          <head>
            <title>Hello</title>
            <script src={bundle.resolve("client.js")}></script>
            <link rel="stylesheet" href={bundle.resolve("client.css")} />
          </head>
          <body class="bg-black text-white">
            <div>{yield* next().text}</div>
          </body>
        </html>
      )
    }),
  ),
  "/": Route.get(Route.redirect("/todos")),
  "/todos": Route.get(
    Route.html(function* () {
      return <p>hello</p>
    }),
  ),
})

if (import.meta.main) {
  const app = Start.build(
    Route.layer(routes),
    BunBundle.layer({
      entrypoints: [import.meta.resolve("./client.js"), import.meta.resolve("./client.css")],
      plugins: [TailwindPlugin.make()],
    }),
  )

  Start.serve(app)
}
