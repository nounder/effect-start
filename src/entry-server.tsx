import { Route, Router, useCurrentMatches } from "@nounder/solid-router"
import { RandomComponent } from "./ui.tsx"
import routes from "./routes.ts"
import { ErrorBoundary, HydrationScript, ssr } from "solid-js/web"
import { createSignal, sharedConfig } from "solid-js"
import { StaticRouter } from "../lib/solid-router/routers/StaticRouter.ts"
import App from "./App.tsx"

const docType = ssr("<!DOCTYPE html>")

function ServerWrapper(props) {
  // todo: this should be empty if there are no matches.
  // depending on that return 404?
  const m = useCurrentMatches()

  if (m().length === 0) {
    return `~*~ 404 Not Found ~*~`
  }

  return (
    <Document>
      {props.children}
    </Document>
  )
}

function ServerErrorBoundary(props) {
  return (
    <ErrorBoundary
      fallback={(error) => {
        return (
          <>
            <span style="font-size:1.5em;text-align:center;position:fixed;left:0px;bottom:55%;width:100%;">
              Oops. Something bad happened. See server console.
              <pre>
                {JSON.parse(error)}
              </pre>
            </span>
          </>
        )
      }}
    >
      {props.children}
    </ErrorBoundary>
  )
}

function Document(props) {
  // @ts-expect-error
  sharedConfig.context.noHydrate = true

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

          <HydrationScript />
          <script type="module" src="./src/entry-client.tsx"></script>
        </head>
        <body>
          <App />
        </body>
      </html>
    </>
  )
}

export default function (props: { url: string }) {
  return (
    <StaticRouter
      url={props.url}
      root={ServerWrapper}
    >
      {routes.map(([path, component]) => (
        <Route path={path} component={component} />
      ))}
    </StaticRouter>
  )
}
