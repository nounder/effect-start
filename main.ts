import {
  HttpApp,
  HttpMiddleware,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/platform"
import { Effect, Stream } from "effect"
import entry from "./entry-server.tsx"
import { renderToStringAsync } from "solid-js/web"

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

const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "*",
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest
      const body = yield* render(req.url)

      return HttpServerResponse.html(body)
    }),
  ),
  HttpRouter.use(HttpMiddleware.logger),
)

Deno.serve(
  HttpApp.toWebHandler(router),
)
