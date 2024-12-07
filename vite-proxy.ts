// Deno HTTP Proxy Server
// Run with: deno run --allow-net proxy_server.ts

const TARGET_URL = "http://0.0.0.0:5173" // Target server to proxy requests to

// Unified proxy handler
async function handleRequest(req: Request): Promise<Response> {
  try {
    // Extract path and query from the original request
    const url = new URL(req.url)
    const targetUrl = `${TARGET_URL}${url.pathname}${url.search}`

    // Create a new request to the target server
    const proxyReq = new Request(targetUrl, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    })

    // If it's a WebSocket upgrade, handle it specially
    if (req.headers.get("upgrade") === "websocket") {
      const { socket: localSocket, response } = Deno.upgradeWebSocket(req, {
        protocol: req.headers.get("sec-websocket-protocol") || undefined,
      })
      const targetSocket = new WebSocket(
        targetUrl.replace("http", "ws"),
        "vite-hmr",
      )

      targetSocket.addEventListener("open", () => {
        targetSocket.send('{"type":"connected"}')
        console.log("targetSocket.addEventListener")
      })

      targetSocket.onerror = (event) => {
        console.log("targetSocket.onerror")
        localSocket.close()
      }

      targetSocket.onopen = () => {
        console.log("targetSocket.onopen")
      }

      // Bidirectional message forwarding
      targetSocket.onmessage = (event) => {
        console.log("target", event)
        localSocket.send(event.data)
      }

      targetSocket.onclose = () => {
        console.log("targetSocket.onclose")
        localSocket.close()
      }

      console.log(response.headers)
      return response
    }

    // Forward the request to the target server
    return await fetch(proxyReq)
  } catch (error) {
    console.error(error)
    return new Response(`Proxy error: ${error.message}`, { status: 500 })
  }
}

// Start the Deno HTTP server
Deno.serve({
  port: 8000,
}, handleRequest)
