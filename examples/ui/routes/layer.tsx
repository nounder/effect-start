import { Bundle, Html, Route } from "effect-start"

export default Route.use(
  Route.html(function*(_, next) {
    const bundle = yield* Bundle.Bundle
    return [
      Html.unsafe("<!doctype html>"),
      (
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="color-scheme" content="light dark" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta name="description" content="Tailwind-first UI components for effect-start, built on native HTML." />
            <title>
              Components — effect/ui
            </title>
            <link
              rel="icon"
              href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2318181b'/%3E%3Cpath d='M10 22 22 10M15 24 24 15' stroke='white' stroke-width='2.5'/%3E%3C/svg%3E"
            />
            <link rel="stylesheet" href={bundle.resolve("app.css")} />
            <script type="module" src={bundle.resolve("effect-start/datastar")} />
          </head>
          <body class="bg-background text-foreground font-sans antialiased">
            {yield* next.html}
          </body>
        </html>
      ),
    ]
  }),
)
