import {
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Effect } from "effect"
import { renderToStringAsync } from "solid-js/web"
import App from "./App.tsx"
import ServerRoot from "./ServerRoot.tsx"

async function _fetch(req: Request) {
  const comp = () => (
    <ServerRoot url={req.url} resolve={v => v}>
      <App />
    </ServerRoot>
  )

  const output = await renderToStringAsync(comp, {
    timeoutMs: 4000,
  })

  if (output.includes("~*~ 404 Not Found ~*~")) {
    return new Response(output, {
      status: 404,
    })
  }

  return new Response(output, {
    headers: {
      "Content-Type": "text/html",
    },
  })
}

export default Effect.gen(function*() {
  const req = yield* HttpServerRequest.HttpServerRequest
  const fetchReq = req.source as Request
  const output = yield* Effect.tryPromise(() => _fetch(fetchReq))

  return HttpServerResponse.raw(output.body, {
    status: output.status,
    statusText: output.statusText,
    headers: Headers.fromInput(output.headers as any),
  })
})
