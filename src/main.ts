import {
  HttpApp,
  HttpMiddleware,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Effect } from "effect"
import entry from "./entry-server.tsx"
import { renderToStringAsync } from "solid-js/web"
import { ViteDev, ViteDevHttpRouteHandler } from "./vite/effect.ts"

const viteRoute = HttpRouter.all(
  "*",
  ViteDevHttpRouteHandler,
)

const ssrRoute = HttpRouter.get(
  "*",
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    const body = yield* render(req.url)

    return HttpServerResponse.html(body)
  }),
)

const render = (url) =>
  Effect.tryPromise({
    try: () =>
      renderToStringAsync(() =>
        entry({
          url,
        })
      ),
    catch: (err) => new Error("Couldn't server render"),
  })

export const Router = HttpRouter.empty.pipe(
  viteRoute,
  HttpRouter.use(HttpMiddleware.logger),
  Effect.provide(ViteDev),
)

if (import.meta.main) {
  Deno.serve(
    HttpApp.toWebHandler(Router),
  )
}
