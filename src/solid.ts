import {
  FileSystem,
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { BunFileSystem } from "@effect/platform-bun"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import { Array, Console, Effect, pipe, Stream } from "effect"
import { renderToStringAsync } from "solid-js/web"
import BunBuild, { BunBuildHttpRoute } from "./bun/BunBuild.ts"
import entryServer from "./entry-server.tsx"

const SolidSsrRoute = Effect.gen(function*() {
  const req = yield* HttpServerRequest.HttpServerRequest
  const bunBuild = yield* BunBuild

  const res = yield* Effect.tryPromise(() =>
    renderToStringAsync(() =>
      entryServer({
        url: req.url,
        resolve: bunBuild.resolve,
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
  )

  return HttpServerResponse.raw(res.body, {
    status: res.status,
    // @ts-ignore it works
    headers: Headers.fromInput(res.headers),
  })
})

const StaticRoute = Effect.gen(function*() {
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
  Effect.catchAllCause((e) => {
    console.error(e)
    return HttpServerResponse.empty({
      status: 404,
    })
  }),
)

// TODO: log errors happening in the chain
// it's each route responsibility to handle excpected errors
export const FrontendRoute = pipe(
  [
    BunBuildHttpRoute,
    SolidSsrRoute,
    // StaticRoute,
  ],
  Array.map((route) =>
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
