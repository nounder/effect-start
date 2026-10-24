import { Bundle, Route } from "effect-start"

export default Route.use(
  Route.html(function* (ctx, next) {
    const bundle = yield* Bundle.Bundle

    return (
      <html>
        <title>Github Explorer</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        {/* TODO: how to base relatiev imports: cwd or relatiev to layer
        how to get base form layer file */}
        <link
          rel="stylesheet"
          href={bundle.resolve("app.css")}
        />
        <script
          async
          type="module"
          src={bundle.resolve("effect-start/datastar")}
        ></script>

        <body class="h-full bg-[#0d1117] font-sans text-[#e6edf3] antialiased">
          {yield* next.html}
        </body>
      </html>
    )
  }),
)
