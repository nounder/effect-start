import {
  FileSystem,
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Array as Arr, Console, Effect, pipe } from "effect"
import entryServer from "./entry-server.tsx"
import { renderToStringAsync } from "solid-js/web"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import { ViteDevServerHttpRoute } from "./vite/ViteDevServer.ts"
import { BunFileSystem } from "@effect/platform-bun"
import { BunBuildHttpRoute } from "./bun/BunBuild"

const SolidSsrRoute = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest

  const res = yield* Effect.tryPromise(() => renderSsr(req.url))

  return HttpServerResponse.raw(res.body, {
    status: res.status,
    // @ts-ignore it works
    headers: Headers.fromInput(res.headers),
  })
})

const StaticRoute = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest
  const fs = yield* FileSystem.FileSystem

  const url = new URL(req.originalUrl)
  // TODO: resolve local path safely
  const localPath = "www/" + url.pathname.slice(1)

  const stat = yield* fs.stat(localPath)

  return HttpServerResponse.stream(
    fs.stream(localPath),
    {
      headers: {
        "content-type": stat.size.toString(),
      },
    },
  )
}).pipe(
  // TODO: this is a workaround. otherwise array defined below screams
  Effect.provide(BunFileSystem.layer),
  // TODO: instead of catching all, catch only SystemError
  Effect.catchAllCause(() =>
    HttpServerResponse.empty({
      status: 404,
    })
  ),
)

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

// TODO: log errors happening in the chain
// it's each route responsibility to handle excpected errors
export const FrontendRoute = pipe(
  [
    BunBuildHttpRoute,
    SolidSsrRoute,
    //StaticRoute,
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
