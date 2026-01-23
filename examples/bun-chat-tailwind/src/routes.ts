import {
  Development,
  Entity,
  Route,
} from "effect-start"
import chat from "./chat.tsx"

export default Route.tree({
  "/": Route.get(
    Route.render(function*() {
      return Entity.make("", {
        status: 301,
        headers: {
          "location": "/chat",
        },
      })
    }),
  ),
  "/chat": chat,
  "/data.json": Route
    .get(
      Route.json(function*() {
        return {
          woah22: 23,
        }
      }),
    ),

  "/dev": Route.get(
    Route.sse(
      Development.stream(),
    ),
  ),
})
