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
import { IncomingMessage, OutgoingMessage, ServerResponse } from "node:http"
import { Socket } from "node:net"

const viteServer = Effect.tryPromise(async () => {
  const { createServer } = await import("vite")

  return await createServer({
    server: {
      middlewareMode: true,
    },
  })
})

const viteRoute = HttpRouter.all(
  "*",
  Effect.gen(function* () {
    const vite = yield* Effect.cached(viteServer).pipe(Effect.flatten)
    const req = yield* HttpServerRequest.HttpServerRequest

    const socket = new Socket()
    const nodeReq = new IncomingMessage(socket)
    nodeReq.url = req.url
    nodeReq.method = req.method
    nodeReq.headers = req.headers

    const nodeRes: OutgoingMessage & {
      _headers: Record<string, string>
      _controller: ReadableStreamController<any> | null
      writeHead: (statusCode: number) => void
      statusCode: number
    } = {
      _headers: {},
      _controller: null,
      statusCode: 200,
      headersSent: false,
      setHeader(name: string, value: string) {
        this._headers[name.toLowerCase()] = value

        return this
      },
      getHeader(name: string) {
        return this._headers[name.toLowerCase()]
      },
      writeHead(statusCode) {
        this.statusCode = statusCode
      },
      write(chunk) {
        this["_controller"]?.enqueue(chunk)

        return true
      },
      end() {
        this["_controller"]?.close

        return this
      },
    }

    const readable = new ReadableStream({
      start(controller) {
        nodeRes["_controller"] = controller
      },
    })

    // todo pass node request and response to vite and when vite is done, convert the response to solid http response
    vite.middlewares.handle(nodeReq, nodeRes, (e) => {
      console.log(e)
    })

    return HttpServerResponse.raw(readable)
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
)

Deno.serve(
  HttpApp.toWebHandler(router),
)
