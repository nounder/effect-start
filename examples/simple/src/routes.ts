import { Route } from "effect-start"

export default Route.tree({
  "/": Route.get(
    Route.text("Homepage"),
  ),
  "/data.json": Route.redirect("/"),
  "/data.json": Route
    .get(
      Route.json(function*() {
        return {}
      }),
    ),
})
