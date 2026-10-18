import { Effect, Stream } from "effect"
import { Development, Route } from "effect-start"
import { HttpClient } from "effect/http"

export default Route.get(
  Route.sse(
    Effect.gen(function*() {
      const client = yield* HttpClient.HttpClient
      const request = yield* Route.Request
      const referer = request.headers.get("referer") ??
        new URL(request.url).origin

      return Development.events.pipe(
        Stream.debounce("50 millis"),
        // TODO: use RouteHttp with cookies and headers instead of sending external request
        Stream.mapEffect(() => client.get(referer).pipe(Effect.flatMap((v) => v.text))),
        Stream.map((html) => ({
          event: "datastar-patch-elements",
          // TODO:
          data: [
            "mode outer",
            ...html.split("\n").map((line) => `elements ${line}`),
          ],
        })),
      )
    }),
  ),
)
