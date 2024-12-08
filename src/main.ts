import {
  Headers,
  HttpApp,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Array as Arr, Effect, Layer } from "effect"
import entry from "./entry-server.tsx"
import { renderToStringAsync } from "solid-js/web"
import { ViteDev, ViteDevHttpRouteHandler } from "./vite/effect.ts"
import { pipe } from "effect/Function"
import { RouteNotFound } from "@effect/platform/HttpServerError"

const SolidSsrHandler = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest
  const res = yield* render(req.url)

  return HttpServerResponse.raw(res.body, {
    status: res.status,
    // @ts-ignore it works
    headers: Headers.fromInput(res.headers),
  })
})

const render = (url) =>
  Effect.tryPromise(() =>
    renderToStringAsync(() =>
      entry({
        url,
      })
    )
      .then((body) => {
        if (body.includes("~*~ 404 Not Found ~*~")) {
          return new Response("", {
            status: 404,
          })
        }

        return new Response(body)
      })
  )

const HttpServerDeno = Layer.scoped(
  HttpServer.HttpServer,
  Effect.runtime().pipe(Effect.andThen((runtime) =>
    HttpServer.make({
      serve: (app) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const handler = HttpApp.toWebHandlerRuntime(runtime)(app)

            return Deno.serve({
              hostname: "0.0.0.0",
              port: 8000,
              onListen: () => {},
            }, handler)
          }),
          (server) =>
            Effect.promise(async () => {
              await server.shutdown()
            }),
        ),
      address: {
        _tag: "TcpAddress",
        hostname: "0.0.0.0",
        port: 8000,
      },
    })
  )),
)

const FrontendHandler = pipe(
  [
    SolidSsrHandler,
    ViteDevHttpRouteHandler,
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
  Layer.provide(HttpServerDeno),
)

await Effect.runPromise(
  Layer.launch(app)
    .pipe(
      Effect.provide(ViteDev),
    ),
)
