import {
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Array as Arr, Effect } from "effect"
import entryServer from "./entry-server.tsx"
import { renderToStringAsync } from "solid-js/web"
import { pipe } from "effect/Function"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import { ViteDevServerHttpRoute } from "./vite/ViteDevServer.ts"

const SolidSsrRoute = Effect.gen(function* () {
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

export const FrontendRoute = pipe(
  [
    ViteDevServerHttpRoute,
    SolidSsrRoute,
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
