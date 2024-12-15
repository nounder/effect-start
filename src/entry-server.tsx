import { Route, StaticRouter, useCurrentMatches } from "@nounder/solid-router"
import { RandomComponent } from "./ui.tsx"
import {
  ErrorBoundary,
  Hydration,
  HydrationScript,
  NoHydration,
  ssr,
} from "solid-js/web"
import { sharedConfig } from "solid-js"

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
  // for some reason <NoHydration> is evaluated last
  // instead of first \__(-_-)__/
  sharedConfig.context.noHydrate = true

  return (
    <NoHydration>
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
          <Hydration>
            <ServerErrorBoundary>
              {props.children}
            </ServerErrorBoundary>
          </Hydration>
        </body>
      </html>
    </NoHydration>
  )
}

export default function (args: { url: string }) {
  return (
    <StaticRouter
      url={args.url}
      root={ServerWrapper}
    >
      <Route path="/" component={RandomComponent} />
      <Route path="/random" component={RandomComponent} />
    </StaticRouter>
  )
}
