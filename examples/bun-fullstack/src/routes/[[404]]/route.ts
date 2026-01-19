import { Route } from "effect-start"

export default Route.use(
  Route.text("404 Not Found"),
  Route.json({
    error: "Not Found",
  }),
)
