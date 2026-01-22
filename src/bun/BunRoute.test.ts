import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Route from "../Route.ts"
import * as BunHttpServer from "./BunHttpServer.ts"
import * as BunRoute from "./BunRoute.ts"

const layerServer = Layer.scoped(
  BunHttpServer.BunHttpServer,
  BunHttpServer.make({ port: 0 }),
)

const testLayer = (routes: ReturnType<typeof Route.tree>) =>
  Layer.provideMerge(
    BunHttpServer.layerRoutes(routes),
    layerServer,
  )

test.describe("BunRoute.bundle", () => {
  test.test("wraps child content with layout", async () => {
    const routes = Route.tree({
      "/": Route.get(
        BunRoute.bundle(() => import("../../static/LayoutSlots.html")),
        Route.html("<p>Hello World</p>"),
      ),
    })

    const response = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunHttpServer.BunHttpServer
            return yield* Effect.promise(() =>
              fetch(`http://localhost:${bunServer.server.port}/`)
            )
          })
          .pipe(Effect.provide(testLayer(routes))),
      ),
    )

    test.expect(response.status).toBe(200)
    const html = await response.text()
    test.expect(html).toContain("<p>Hello World</p>")
    test.expect(html).toContain("<body>")
    test.expect(html).toContain("</body>")
  })

  test.test("replaces %yield% with child content", async () => {
    const routes = Route.tree({
      "/page": Route.get(
        BunRoute.bundle(() => import("../../static/LayoutSlots.html")),
        Route.html("<div>Page Content</div>"),
      ),
    })

    const response = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunHttpServer.BunHttpServer
            return yield* Effect.promise(() =>
              fetch(`http://localhost:${bunServer.server.port}/page`)
            )
          })
          .pipe(Effect.provide(testLayer(routes))),
      ),
    )

    const html = await response.text()
    test.expect(html).toContain("<div>Page Content</div>")
    test.expect(html).not.toContain("%children%")
  })

  test.test("works with use() for wildcard routes", async () => {
    const routes = Route.tree({
      "*": Route.use(
        BunRoute.bundle(() => import("../../static/LayoutSlots.html")),
      ),
      "/:path*": Route.get(Route.html("<section>Catch All</section>")),
    })

    const response = await Effect.runPromise(
      Effect.scoped(
        Effect
          .gen(function*() {
            const bunServer = yield* BunHttpServer.BunHttpServer
            return yield* Effect.promise(() =>
              fetch(`http://localhost:${bunServer.server.port}/any/path`)
            )
          })
          .pipe(Effect.provide(testLayer(routes))),
      ),
    )

    test.expect(response.status).toBe(200)
    const html = await response.text()
    test.expect(html).toContain("<section>Catch All</section>")
  })
})

test.describe("BunRoute.validateBunPattern", () => {
  test.test("returns none for valid patterns", () => {
    test
      .expect(Option.isNone(BunRoute.validateBunPattern("/users")))
      .toBe(true)
    test
      .expect(Option.isNone(BunRoute.validateBunPattern("/users/[id]")))
      .toBe(true)
    test
      .expect(Option.isNone(BunRoute.validateBunPattern("/[...rest]")))
      .toBe(true)
  })

  test.test("returns error for prefixed params", () => {
    const result = BunRoute.validateBunPattern("/pk_[id]")
    test.expect(Option.isSome(result)).toBe(true)
  })

  test.test("returns error for suffixed params", () => {
    const result = BunRoute.validateBunPattern("/[id]_suffix")
    test.expect(Option.isSome(result)).toBe(true)
  })
})

test.describe("BunRoute.isHTMLBundle", () => {
  test.test("returns false for non-objects", () => {
    test.expect(BunRoute.isHTMLBundle(null)).toBe(false)
    test.expect(BunRoute.isHTMLBundle(undefined)).toBe(false)
    test.expect(BunRoute.isHTMLBundle("string")).toBe(false)
  })

  test.test("returns true for object with index property", () => {
    test.expect(BunRoute.isHTMLBundle({ index: "index.html" })).toBe(true)
  })
})
