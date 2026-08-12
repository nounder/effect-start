import * as test from "bun:test"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as Effect from "effect/Effect"

function makeHandler(options?: Parameters<typeof Route.trailingSlashRedirect>[0]) {
  return Fetch.fromHandler(
    RouteHttp.toWebHandler(
      Route.use(Route.trailingSlashRedirect(options)).get(
        Route.text("ok"),
      ).post(Route.text("ok")),
    ),
  )
}

test.describe("Route.trailingSlashRedirect", () => {
  test.describe("default (strip) mode", () => {
    const client = makeHandler()

    test.it("redirects a path with a trailing slash to its canonical form", () =>
      Effect
        .gen(function*() {
          const entity = yield* client.get("http://localhost/foo/")

          test
            .expect(entity.status)
            .toBe(308)
          test
            .expect(entity.headers["location"])
            .toBe("/foo")
        })
        .pipe(Effect.runPromise))

    test.it("redirects nested paths with a trailing slash", () =>
      Effect
        .gen(function*() {
          const entity = yield* client.get("http://localhost/foo/bar/")

          test
            .expect(entity.status)
            .toBe(308)
          test
            .expect(entity.headers["location"])
            .toBe("/foo/bar")
        })
        .pipe(Effect.runPromise))

    test.it("preserves the query string when redirecting", () =>
      Effect
        .gen(function*() {
          const entity = yield* client.get("http://localhost/foo/?a=1&b=2")

          test
            .expect(entity.status)
            .toBe(308)
          test
            .expect(entity.headers["location"])
            .toBe("/foo?a=1&b=2")
        })
        .pipe(Effect.runPromise))

    test.it("passes through a path without a trailing slash", () =>
      Effect
        .gen(function*() {
          const entity = yield* client.get("http://localhost/foo")

          test
            .expect(entity.status)
            .toBe(200)
        })
        .pipe(Effect.runPromise))

    test.it("never redirects the root path", () =>
      Effect
        .gen(function*() {
          const entity = yield* client.get("http://localhost/")

          test
            .expect(entity.status)
            .toBe(200)
        })
        .pipe(Effect.runPromise))

    test.it("redirects non-GET requests, preserving method via 308", () =>
      Effect
        .gen(function*() {
          const entity = yield* client.post("http://localhost/foo/")

          test
            .expect(entity.status)
            .toBe(308)
          test
            .expect(entity.headers["location"])
            .toBe("/foo")
        })
        .pipe(Effect.runPromise))
  })

  test.describe("append mode", () => {
    const client = makeHandler({ mode: "append" })

    test.it("redirects a bare path to add a trailing slash", () =>
      Effect
        .gen(function*() {
          const entity = yield* client.get("http://localhost/foo")

          test
            .expect(entity.status)
            .toBe(308)
          test
            .expect(entity.headers["location"])
            .toBe("/foo/")
        })
        .pipe(Effect.runPromise))

    test.it("passes through a path that already has a trailing slash", () =>
      Effect
        .gen(function*() {
          const entity = yield* client.get("http://localhost/foo/")

          test
            .expect(entity.status)
            .toBe(200)
        })
        .pipe(Effect.runPromise))

    test.it("never redirects the root path", () =>
      Effect
        .gen(function*() {
          const entity = yield* client.get("http://localhost/")

          test
            .expect(entity.status)
            .toBe(200)
        })
        .pipe(Effect.runPromise))
  })

  test.describe("custom status", () => {
    const client = makeHandler({ status: 301 })

    test.it("uses the configured redirect status code", () =>
      Effect
        .gen(function*() {
          const entity = yield* client.get("http://localhost/foo/")

          test
            .expect(entity.status)
            .toBe(301)
        })
        .pipe(Effect.runPromise))
  })
})
