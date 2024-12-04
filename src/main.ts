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

    socket.on("connect", console.log)

    const viteRes = new ServerResponse(viteReq)
    const viteResFuture = Promise.withResolvers()

    const readable = new ReadableStream({
      start(controller) {
        viteRes.write = function (chunk) {
          console.log("yoo", chunk)
          controller.enqueue(chunk)

          return true
        }

        viteRes.end = function () {
          controller.close()

          viteResFuture.resolve(undefined)

          return this
        }
      },
    })

    // todo pass node request and response to vite and when vite is done, convert the response to solid http response
    // TODO: it's neer calle
    vite.middlewares.handle(viteReq, viteRes, (e) => {
      viteRes.write("dsasdaasd")
      console.log("oaaaaa", e)
    })

    yield* Effect.promise(() => viteResFuture.promise)

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

const router = HttpRouter.empty.pipe(
  viteRoute,
  HttpRouter.use(HttpMiddleware.logger),
  Effect.provide(Vite.ViteDev),
)

if (import.meta.main) {
  Deno.serve(
    HttpApp.toWebHandler(router),
  )
}
