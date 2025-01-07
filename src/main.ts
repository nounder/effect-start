import {
  Headers,
  HttpApp,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Array as Arr, Effect, Layer } from "effect"
import entryServer from "./entry-server.tsx"
import { renderToStringAsync } from "solid-js/web"
import { ViteDev, ViteDevHttpRouteHandler } from "./vite/effect.ts"
import { pipe } from "effect/Function"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import { DenoHttpServer } from "./effect/deno.ts"

const SolidSsrHandler = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest
  const res = yield* Effect.tryPromise(() => renderSsr(req.url))

  return HttpServerResponse.raw(res.body, {
    status: res.status,
    // @ts-ignore it works
    headers: Headers.fromInput(res.headers),
  })
})

const renderSsr = (url) =>
  renderToStringAsync(() =>
    entryServer({
      url,
    }), { "timeoutMs": 4000 })
    .then((body) => {
      if (body.includes("~*~ 404 Not Found ~*~")) {
        return new Response("", {
          status: 404,
        })
      }

      return new Response(body, {
        headers: {
          "Content-Type": "text/html",
        },
      })
    })

const FrontendHandler = pipe(
  [
    ViteDevHttpRouteHandler,
    SolidSsrHandler,
  ],
  Arr.map((route) =>
    route.pipe(
      Effect.andThen(
        (res) =>
          res.status === 404
            ? Effect.andThen(
              HttpServerRequest.HttpServerRequest,
              (request) => Effect.fail(new RouteNotFound({ request })),
            )
            : res,
      ),
    )
  ),
  Effect.firstSuccessOf,
)

export const router = HttpRouter.empty.pipe(
  HttpRouter.get("/yo", Effect.sync(() => HttpServerResponse.text("yo"))),
  HttpRouter.all("*", FrontendHandler),
)

const app = router.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(DenoHttpServer),
)

await Effect.runPromise(
  Layer.launch(app)
    .pipe(
      Effect.provide(ViteDev),
    ),
)
