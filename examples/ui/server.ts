import { Route, Start } from "effect-start"
import { BunBundle } from "effect-start/bun"
import { TailwindPlugin } from "effect-start/tailwind"
import commandRoute from "./routes/command/route.tsx"
import layer from "./routes/layer.tsx"
import route from "./routes/route.tsx"

Start.serve(Start.pack(
  Route.layer({ "/": [...layer, ...route], "/command": commandRoute }),
  BunBundle.layer({
    entrypoints: [
      import.meta.resolve("./app.css"),
      "effect-start/datastar",
    ],
    plugins: [TailwindPlugin.make()],
  }),
))
