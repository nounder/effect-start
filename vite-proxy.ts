// Deno HTTP Proxy Server
// Run with: deno run --allow-net proxy_server.ts
import { Buffer } from "node:buffer"
import { IncomingMessage, ServerResponse } from "node:http"
import { Socket } from "node:net"
import * as vite from "vite"

const TARGET_URL = "http://0.0.0.0:5173" // Target server to proxy requests to

const viteDevServer = await vite.createServer({
  server: {
    middlewareMode: true,
  },
})

// Unified proxy handler
async function handleRequest(req: Request): Promise<Response> {
  try {
    // Extract path and query from the original request
    const url = new URL(req.url)
    const targetUrl = `${TARGET_URL}${url.pathname}${url.search}`

    const socket = new Socket()
    const viteReq = new IncomingMessage(socket)

    viteReq.url = `${url.pathname}${url.search}`
    viteReq.method = req.method
    viteReq.headers = { ...req.headers }

    console.log(viteReq.headers)

    const viteRes = new ServerResponse(viteReq)
    const viteResFuture = Promise.withResolvers<void>()

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    // Create a new request to the target server
    const proxyReq = new Request(targetUrl, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    })

    viteRes.write = function (chunk) {
      writer.write(Buffer.from(chunk))

      return true
    }

    viteRes.end = function (chunk?) {
      if (chunk) {
        writer.write(Buffer.from(chunk))
      }

      writer.close()
      viteResFuture.resolve()

      return this
    }

    viteDevServer.middlewares.handle(viteReq, viteRes, (err) => {
      if (err) {
        console.error("Vite middleware error:", err)
        writer.abort(err)
        viteResFuture.reject(err)
      }
    })

    await viteResFuture.promise

    return new Response(readable, {
      status: viteRes.statusCode,
      headers: new Headers(viteRes.getHeaders()),
    })
  } catch (error) {
    console.error(error)
    return new Response(`Proxy error: ${error.message}`, { status: 500 })
  }
}

// Start the Deno HTTP server
Deno.serve({
  port: 8000,
}, handleRequest)
