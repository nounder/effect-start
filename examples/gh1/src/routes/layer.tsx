import { Route, Bundle } from "effect-start"

export default Route.use(
  Route.html(function* (ctx, next) {
    const bundle = yield* Bundle.ClientBundle

    return (
      <html>
        <title>Github Explorer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* TODO: how to base relatiev imports: cwd or relatiev to layer
        how to get base form layer file */}
        <link rel="stylesheet" href={bundle.resolve("app.css")} />
        <script async type="module" src={bundle.resolve("effect-start/datastar")}></script>

        <body class="h-full bg-[#0d1117] text-[#e6edf3] font-sans antialiased">
          {yield* next().text}
        </body>
      </html>
    )
  }),
)
