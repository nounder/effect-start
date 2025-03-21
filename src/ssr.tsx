import {
  Headers,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Effect } from "effect"
import { renderToStringAsync } from "solid-js/web"
import App from "./App.tsx"
import { createContext, useContext } from "solid-js"
import { ErrorBoundary, ssr } from "solid-js/web"

export async function renderRequest(req: Request) {
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

export const SsrApp = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest
  const fetchReq = req.source as Request
  const output = yield* Effect.tryPromise(() => renderRequest(fetchReq))

  return HttpServerResponse.raw(output.body, {
    status: output.status,
    statusText: output.statusText,
    headers: Headers.fromInput(output.headers as any),
  })
})


const docType = ssr("<!DOCTYPE html>")

const ServerContext = createContext({
  resolve: (url: string) => url as string | undefined,
})

function Document(props: {
  children: any
}) {
  const server = useContext(ServerContext)
  const entryScriptUrl = server.resolve(
    import.meta.resolve("./entry-client.tsx"),
  )

  return (
    <>
      {docType as unknown as any}

      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <title>solid-deno</title>

          <link rel="stylesheet" href="/.bundle/app.css" />
        </head>

        <body>
          {props.children}
        </body>

        <script type="module" src={entryScriptUrl}></script>
      </html>
    </>
  )
}

export default function ServerRoot(props: {
  children?: any
  url: string
  resolve: (url: string) => string | undefined
}) {
  const ctx = {
    resolve: props.resolve,
  }

  return (
    <ErrorBoundary
      fallback={(error) => (
        <span>{error?.message || JSON.stringify(error)}</span>
      )}
    >
      <ServerContext.Provider value={ctx}>
        {props.children}
      </ServerContext.Provider>
    </ErrorBoundary>
  )
}

