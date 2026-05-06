import { Context, Effect, Layer } from "effect"
import { Start, Route, Bundle } from "effect-start"
import { BunBundle } from "effect-start/bun"
import { TailwindPlugin } from "effect-start/tailwind"

class SomeService extends Context.Tag("SomeService")<SomeService, {}>() {}

const routes = Route.map({
  "*": Route.use(
    Route.html(function* (_ctx, next) {
      const bundle = yield* Bundle.ClientBundle
      const service = yield* SomeService

      return (
        <>
          {"<!DOCTYPE html>"}
          <html>
            <head>
              <title>Hello</title>
              <script src={bundle.resolve("client.js")}></script>
              <link rel="stylesheet" href={bundle.resolve("client.css")} />
            </head>
            <body class="bg-black text-white">
              {/* TODO: figure out better api */}
              <div>{yield* next().text}</div>
            </body>
          </html>
        </>
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

const cb = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* Bundle.ServerBundle
    return {}
  }),
)

export default Start.pack(
  // Layer.succeed(SomeService, {}),
  BunBundle.layer({
    entrypoints: [import.meta.resolve("./client.js"), import.meta.resolve("./client.css")],
    plugins: [TailwindPlugin.make()],
  }),

  Route.layer(routes),
)

Start.serve(() => import("./SimpleBundle.tsx"))
