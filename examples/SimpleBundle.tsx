import { Context, Layer, Schema } from "effect"
import { Bundle, Route, Start } from "effect-start"
import { BunBundle } from "effect-start/bun"
import { TailwindPlugin } from "effect-start/tailwind"

class SomeService extends Context.Tag("SomeService")<SomeService, {}>() {}

const routes = Route.map({
  "*": Route.use(
    Route.html(function*(props, next) {
      const bundle = yield* Bundle.ClientBundle
      yield* SomeService

      return (
        <html>
          <head>
            <title>
              Hello
            </title>
            <script src={bundle.resolve("client.js")} />
            <link rel="stylesheet" href={bundle.resolve("client.css")} />
          </head>
          <body class="bg-black text-white">
            {/* TODO: figure out better api */}
            <div>
              {yield* next.html}
            </div>
          </body>
        </html>
      )
    }),
  ),
  "/": Route.get(Route.redirect("/todos")),
  "/todos": Route
    .get(
      Route.html(function*() {
        return (
          <p>
            <b>
              h
            </b>ello
          </p>
        )
      }),
    )
    .post(
      Route.schemaBodyJson({
        name: Schema.String,
      }),
      Route.json(function*() {
        return {
          ok: true,
        }
      }),
    ),
})

export default Start.pack(
  Layer.succeed(SomeService, {}),
  BunBundle.layer({
    entrypoints: [
      import.meta.resolve("./client.js"),
      import.meta.resolve("./client.css"),
    ],
    plugins: [TailwindPlugin.make()],
  }),
  Route.layer(routes),
)

Start.runMain(import.meta)
