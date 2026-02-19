import { Development, Route } from "effect-start"

export default Route.get(Route.sse(Development.stream()))
