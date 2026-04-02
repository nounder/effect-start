import { Stream } from "effect"
import { Development, Route } from "effect-start"

export default Route.get(
  Route.sse(
    Development.events.pipe(
      Stream.map((event) => ({
        type: event._tag,
        event: JSON.stringify(event),
      })),
    ),
  ),
)
