import { Buffer } from "node:buffer"
import {
  IncomingMessage,
  ServerResponse,
} from "node:http"
import { Socket } from "node:net"
import type { ViteDevServer } from "vite"

export async function createViteDevServerHandler(server: ViteDevServer) {
  async function handler(req: Request): Promise<Response> {
    try {
      // Extract path and query from the original request
      const url = new URL(req.url)

      const socket = new Socket()
      const viteReq = new IncomingMessage(socket)

      viteReq.url = `${url.pathname}${url.search}`
      viteReq.method = req.method
      // @ts-ignore it works
      viteReq.headers = { ...req.headers }

      const viteRes = new ServerResponse(viteReq)
      const viteResFuture = Promise.withResolvers<void>()
      const viteNextMiddlewareFuture = Promise.withResolvers<void>()

      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()

      viteRes.write = function(chunk: any) {
        writer.write(Buffer.from(chunk))

        return true
      }

      viteRes.end = function(chunk?: any) {
        if (chunk) {
          writer.write(Buffer.from(chunk))
        }

        writer.close()

        // this is only called when appType is different than custom
        viteResFuture.resolve()

        return this
      }

      server.middlewares.handle(viteReq, viteRes, () => {
        // this is only called when appType=custom
        viteNextMiddlewareFuture.resolve()
      })

      // vite middleware behaves differently depending on appType config.
      // when appType=custom vite adds additional middlewares to generate html
      // causing connect's next() callback to be called when its middleware finishd.
      // for any other appType, the response is closed in a single middleware.
      // based on that we deduce appType and for appType=custom we don't wait
      // for the response to be finished and return our custom html instead.
      const viteAppType = await Promise.race([
        viteResFuture.promise.then(() => "vite" as const),
        viteNextMiddlewareFuture.promise.then(() => "custom" as const),
      ])

      if (viteAppType === "custom") {
        return new Response(null, {
          status: 404,
          // @ts-ignore it's ok
          headers: new Headers(viteRes.getHeaders()),
        })
      }

      return new Response(readable, {
        status: viteRes.statusCode,
        // @ts-ignore it works
        headers: new Headers(viteRes.getHeaders()),
      })
    } catch (error) {
      console.error(error)

      return new Response(`Unexpected proxy server error`, { status: 500 })
    }
  }

  return handler
}
