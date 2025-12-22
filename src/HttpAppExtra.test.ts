import { HttpServerRequest } from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import * as test from "bun:test"
import { Layer } from "effect"
import * as Cause from "effect/Cause"
import * as HttpAppExtra from "./HttpAppExtra.ts"
import { effectFn } from "./testing"

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

test.describe("renderError", () => {
  const routeNotFoundCause = Cause.fail(
    new RouteNotFound({ request: {} as any }),
  )

  test.it("returns JSON for Accept: application/json", () =>
    effect(function*() {
      const response = yield* HttpAppExtra.renderError(
        routeNotFoundCause,
        "application/json",
      )

      test
        .expect(response.status)
        .toEqual(404)
      test
        .expect(response.headers["content-type"])
        .toContain("application/json")
    }))

  test.it("returns HTML for Accept: text/html", () =>
    effect(function*() {
      const response = yield* HttpAppExtra.renderError(
        routeNotFoundCause,
        "text/html",
      )

      test
        .expect(response.status)
        .toEqual(404)
      test
        .expect(response.headers["content-type"])
        .toContain("text/html")
    }))

  test.it("returns plain text for Accept: text/plain", () =>
    effect(function*() {
      const response = yield* HttpAppExtra.renderError(
        routeNotFoundCause,
        "text/plain",
      )

      test
        .expect(response.status)
        .toEqual(404)
      test
        .expect(response.headers["content-type"])
        .toContain("text/plain")
    }))

  test.it("returns JSON by default (no Accept header)", () =>
    effect(function*() {
      const response = yield* HttpAppExtra.renderError(routeNotFoundCause, "")

      test
        .expect(response.status)
        .toEqual(404)
      test
        .expect(response.headers["content-type"])
        .toContain("application/json")
    }))

  test.it("returns 500 for unexpected errors", () =>
    effect(function*() {
      const unexpectedCause = Cause.fail({ message: "Something went wrong" })
      const response = yield* HttpAppExtra.renderError(
        unexpectedCause,
        "application/json",
      )

      test
        .expect(response.status)
        .toEqual(500)
    }))
})
