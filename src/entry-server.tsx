import { Route, Router, useCurrentMatches } from "@solidjs/router"
import { createContext, useContext } from "solid-js"
import { ErrorBoundary, ssr } from "solid-js/web"
import routes from "./routes.ts"

const docType = ssr("<!DOCTYPE html>")

const ServerContext = createContext({
  resolve: (url: string) => url as string | undefined,
})

function ServerWrapper(props: {
  children: any
}) {
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

export default function Root(props: {
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
        <Router
          url={props.url}
          root={ServerWrapper}
        >
          {routes.map(([path, component]) => (
            <Route path={path} component={component} />
          ))}
        </Router>
      </ServerContext.Provider>
    </ErrorBoundary>
  )
}
