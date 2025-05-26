import {
  HttpServerResponse,
} from "@effect/platform"
import {
  Effect,
} from "effect"

export default Effect.gen(function*() {
  return HttpServerResponse.text("I'm API.")
})
