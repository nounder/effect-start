import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as Effect from "effect/Effect"

export interface BasicAuthConfig {
  readonly username: string
  readonly password: string
}

const unauthorizedResponse = HttpServerResponse.empty({
  status: 401,
  headers: { "WWW-Authenticate": "Basic" },
})

export const make = (config: BasicAuthConfig) =>
  HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      const authHeader = request.headers.authorization

      if (!authHeader || !authHeader.startsWith("Basic ")) {
        return unauthorizedResponse
      }

      const base64Credentials = authHeader.slice(6)
      const credentials = atob(base64Credentials)
      const [username, password] = credentials.split(":")

      if (username !== config.username || password !== config.password) {
        return unauthorizedResponse
      }

      return yield* app
    })
  )
