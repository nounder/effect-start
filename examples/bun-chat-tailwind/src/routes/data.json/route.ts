import { Route } from "effect-start"

export default Route.get(
  Route.json(function*() {
    return {
      woah22: 23,
    }
  }),
)
