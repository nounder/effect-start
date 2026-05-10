import { Bundle, Route } from "effect-start"

export default Route.use(
  Route.html(function*(_, next) {
    const bundle = yield* Bundle.Bundle
    return (
      <html class="h-full">
        <head>
          <title>
            Chat
          </title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="stylesheet" href={bundle.resolve("./app.css")} />
          <script type="module" src={bundle.resolve("effect-start/datastar")}>
          </script>
        </head>
        <body class="h-full font-sans" data-init={(e) => e.actions.get("/dev")}>
          {yield* next.html}
        </body>
      </html>
    )
  }),
)
