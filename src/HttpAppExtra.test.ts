import { HttpServerRequest } from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import * as t from "bun:test"
import {
  Effect,
  Layer,
} from "effect"
import * as Cause from "effect/Cause"
import * as HttpAppExtra from "./HttpAppExtra.ts"
import { effectFn } from "./testing.ts"

const mockRequest = HttpServerRequest.HttpServerRequest.of({
  url: "http://localhost:3000/test",
  method: "GET",
  headers: {
    "accept": "application/json",
    "user-agent": "test",
  },
} as any)

const mockRequestLayer = Layer.succeed(
  HttpServerRequest.HttpServerRequest,
  mockRequest,
)

const effect = effectFn(mockRequestLayer)

t.describe("renderError", () => {
  const routeNotFoundCause = Cause.fail(
    new RouteNotFound({ request: {} as any }),
  )

  t.it("returns JSON for Accept: application/json", () =>
    effect(function*() {
      const response = yield* HttpAppExtra.renderError(
        routeNotFoundCause,
        "application/json",
      )

      t.expect(response.status).toEqual(404)
      t.expect(response.headers["content-type"]).toContain("application/json")
    }))

  t.it("returns HTML for Accept: text/html", () =>
    effect(function*() {
      const response = yield* HttpAppExtra.renderError(
        routeNotFoundCause,
        "text/html",
      )

      t.expect(response.status).toEqual(404)
      t.expect(response.headers["content-type"]).toContain("text/html")
    }))

  t.it("returns plain text for Accept: text/plain", () =>
    effect(function*() {
      const response = yield* HttpAppExtra.renderError(
        routeNotFoundCause,
        "text/plain",
      )

      t.expect(response.status).toEqual(404)
      t.expect(response.headers["content-type"]).toContain("text/plain")
    }))

  t.it("returns JSON by default (no Accept header)", () =>
    effect(function*() {
      const response = yield* HttpAppExtra.renderError(routeNotFoundCause, "")

      t.expect(response.status).toEqual(404)
      t.expect(response.headers["content-type"]).toContain("application/json")
    }))

  t.it("returns 500 for unexpected errors", () =>
    effect(function*() {
      const unexpectedCause = Cause.fail({ message: "Something went wrong" })
      const response = yield* HttpAppExtra.renderError(
        unexpectedCause,
        "application/json",
      )

      t.expect(response.status).toEqual(500)
    }))
})
