import {
  Entity,
  Route,
} from "effect-start"

import chat from "./chat.ts"

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
})
