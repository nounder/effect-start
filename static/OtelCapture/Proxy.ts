/**
 * Recording proxy. OTel SDKs export to this, it appends every request to
 * Traffic.ndjson and forwards it verbatim to the studio server.
 */
import * as NFs from "node:fs"
import * as NPath from "node:path"

const UPSTREAM = process.env.UPSTREAM ?? "http://localhost:4318/studio"
const PORT = Number(process.env.PORT ?? 4317)
const DUMP = NPath.join(import.meta.dir, "Traffic.ndjson")

let seq = 0

const server = Bun.serve({
  port: PORT,
  idleTimeout: 30,
  async fetch(request) {
    const url = new URL(request.url)
    const body = new Uint8Array(await request.arrayBuffer())
    const upstreamUrl = `${UPSTREAM}${url.pathname}${url.search}`

    // The body is buffered here, so hop-by-hop framing headers from the exporter
    // (notably transfer-encoding: chunked) no longer describe what we forward.
    const headers = new Headers(request.headers)
    for (const header of ["transfer-encoding", "connection", "keep-alive", "host", "content-length"]) {
      headers.delete(header)
    }

    const response = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: body.length > 0 ? body : undefined,
    })
    const responseBody = new Uint8Array(await response.arrayBuffer())

    NFs.appendFileSync(
      DUMP,
      JSON.stringify({
        seq: seq++,
        path: url.pathname,
        method: request.method,
        requestHeaders: Object.fromEntries(request.headers),
        requestBodyBase64: Buffer.from(body).toString("base64"),
        status: response.status,
        responseHeaders: Object.fromEntries(response.headers),
        responseBodyBase64: Buffer.from(responseBody).toString("base64"),
      }) + "\n",
    )

    const responseHeaders = new Headers(response.headers)
    for (const header of ["transfer-encoding", "connection", "keep-alive", "content-length"]) {
      responseHeaders.delete(header)
    }

    return new Response(responseBody.length > 0 ? responseBody : null, {
      status: response.status,
      headers: responseHeaders,
    })
  },
})

// eslint-disable-next-line no-console
console.log(`proxy listening on http://localhost:${server.port} -> ${UPSTREAM}`)
// eslint-disable-next-line no-console
console.log(`dumping to ${DUMP}`)
