import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import { Route } from "effect-start"
import * as Effect from "effect/Effect"

const basicAuthMiddleware = HttpMiddleware.make((app) =>
  Effect.gen(function*() {
    const request = yield* HttpServerRequest.HttpServerRequest
    const authHeader = request.headers.authorization

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return HttpServerResponse.empty({
        status: 401,
        headers: {
          "WWW-Authenticate": "Basic realm=\"Admin\"",
        },
      })
    }

    const base64Credentials = authHeader.slice(6)
    const credentials = atob(base64Credentials)
    const [username, password] = credentials.split(":")

    if (username !== "admin" || password !== "admin") {
      return HttpServerResponse.empty({
        status: 401,
        headers: {
          "WWW-Authenticate": "Basic realm=\"Admin\"",
        },
      })
    }

    return yield* app
  })
)

export default Route.layer(
  Route.http(basicAuthMiddleware),
  Route.html(function*(context) {
    const inner = yield* context.next()

    return (
      <div className="admin-container">
        <h2>
          Admin Panel
        </h2>
        {inner}
      </div>
    )
  }),
)


