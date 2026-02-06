import { Route } from "effect-start"

export default Route.get(
  Route.render(function* () {
    return Route.redirect("/chat", 301)
  }),
)
