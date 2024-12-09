import { Route, StaticRouter, useCurrentMatches } from "@nounder/solid-router"
import { RandomComponent } from "./ui.tsx"
import { generateHydrationScript, HydrationScript } from "solid-js/web"

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

function Document(props) {
  const baseUrl = ""
  const hydrationScript = generateHydrationScript()

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>solid-deno</title>

        <HydrationScript />
        <script type="module" src="./src/entry-client.tsx"></script>
      </head>
      <body>
        {props.children}
      </body>
    </html>
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
