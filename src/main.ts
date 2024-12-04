import {
  Headers,
  HttpApp,
  HttpMiddleware,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Effect } from "effect"
import entry from "./entry-server.tsx"
import { renderToStringAsync } from "solid-js/web"
import { IncomingMessage, ServerResponse } from "node:http"
import { Socket } from "node:net"
import * as Vite from "./vite.ts"
import { Buffer } from "node:buffer"

const viteRoute = HttpRouter.all(
  "*",
  Effect.gen(function* () {
    const vite = yield* Vite.Vite
    const req = yield* HttpServerRequest.HttpServerRequest

    const socket = new Socket()
    const viteReq = new IncomingMessage(socket)

    viteReq.url = req.url
    viteReq.method = req.method
    viteReq.headers = req.headers

    const viteRes = new ServerResponse(viteReq)
    const viteResFuture = Promise.withResolvers<void>()

    const chunks: Uint8Array[] = []

    viteRes.write = function (chunk) {
      chunks.push(Buffer.from(chunk))
      return true
    }

    viteRes.end = function (chunk?) {
      if (chunk) {
        chunks.push(Buffer.from(chunk))
      }
      viteResFuture.resolve()

      return this
    }

    vite.middlewares.handle(viteReq, viteRes, (err) => {
      if (err) {
        console.error("Vite middleware error:", err)
        viteResFuture.reject(err)
      }
    })

    yield* Effect.promise(() => viteResFuture.promise)

    const body = new Blob(chunks)
    const readable = body.stream()

    return HttpServerResponse.raw(readable, {
      status: viteRes.statusCode,
      headers: Headers.unsafeFromRecord(
        viteRes.getHeaders() as Record<string, string>,
      ),
    })
  }),
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
  Effect.provide(Vite.ViteDev),
)

if (import.meta.main) {
  Deno.serve(
    HttpApp.toWebHandler(Router),
  )
}
