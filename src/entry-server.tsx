import { Route, useCurrentMatches } from "@nounder/solid-router"
import routes from "./routes.ts"
import { ErrorBoundary, ssr } from "solid-js/web"
import { StaticRouter } from "@nounder/solid-router"
import { Show } from "solid-js/web"

const docType = ssr("<!DOCTYPE html>")

function ServerWrapper(props: {
  entryScriptUrl: string
  children: any
}) {
  // todo: this should be empty if there are no matches.
  // depending on that return 404?
  const m = useCurrentMatches()

  if (m().length === 0) {
    return `~*~ 404 Not Found ~*~`
  }

  return (
    <Document
      postBody={
        <Show when={props.entryScriptUrl}>
          {(url) => <script type="module" src={url()}></script>}
        </Show>
      }
    >
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
  postBody?: any
}) {
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

          <link rel="stylesheet" href="/app.css" />
          <script type="module" src="./src/entry-client.tsx"></script>
        </head>
        <body>
          {props.children}
        </body>

        {props.postBody}
      </html>
    </>
  )
}

export default function Root(props: { url: string }) {
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
