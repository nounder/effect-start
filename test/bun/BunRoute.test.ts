import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Route from "../../src/Route.ts"
import { BunRoute, BunServer } from "../../src/bun/index.ts"

const testLayer = (
  routes: ReturnType<typeof Route.tree>,
  options?: {
    development?: boolean
  },
) =>
  BunServer.layerRoutes({
    port: 0,
    ...options,
  }).pipe(Layer.provide(Route.layer(routes)))


const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const countScriptsBySrc = (html: string, targetSrc: string) =>
  (html.match(new RegExp(`<script[^>]*src=["']${escapeRegExp(targetSrc)}["'][^>]*>`, "g")) ?? []).length

const countBunDevScripts = (html: string) =>
  (html.match(/<script[^>]*(?:data-bun-dev-server-script|src=["']\/_bun\/client\/[^"']*)[^>]*>/g) ?? []).length

test.describe(BunRoute.htmlBundle, () => {
  test.test("wraps child content with layout", () => {
    const routes = Route.tree({
      "/": Route.get(
        BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html")),
        Route.html("<p>Hello World</p>"),
      ),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/`),
      )
      const html = yield* Effect.promise(() => response.text())

      test.expect(response.status).toBe(200)
      test.expect(html).toContain("<p>Hello World</p>")
      test.expect(html).toContain("<body>")
      test.expect(html).toContain("</body>")
    }).pipe(Effect.provide(testLayer(routes)), Effect.runPromise)
  })

  test.test("replaces %yield% with child content", () => {
    const routes = Route.tree({
      "/page": Route.get(
        BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html")),
        Route.html("<div>Page Content</div>"),
      ),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/page`),
      )
      const html = yield* Effect.promise(() => response.text())

      test.expect(html).toContain("<div>Page Content</div>")
      test.expect(html).not.toContain("%children%")
    }).pipe(Effect.provide(testLayer(routes)), Effect.scoped, Effect.runPromise)
  })

  test.test("works with use() for wildcard routes", () => {
    const routes = Route.tree({
      "*": Route.use(BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html"))),
      "/:path*": Route.get(Route.html("<section>Catch All</section>")),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/any/path`),
      )

      test.expect(response.status).toBe(200)

      const html = yield* Effect.promise(() => response.text())

      test.expect(html).toContain("<section>Catch All</section>")
    }).pipe(Effect.provide(testLayer(routes)), Effect.scoped, Effect.runPromise)
  })

  test.test("injects HMR script once when multiple htmlBundle wrappers are applied", () =>
    Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/any/path`),
      )
      const html = yield* Effect.promise(() => response.text())

      test.expect(response.status).toBe(200)
      test.expect(html).toContain("<section>Catch All</section>")
      const scriptCount = countBunDevScripts(html)

      test.expect(scriptCount).toBe(1)
    }).pipe(
      Effect.provide(
        testLayer(
          Route.tree({
            "*": Route.use(BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html"))),
            "/:path*": Route.get(
              BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html")),
              Route.html("<section>Catch All</section>"),
            ),
          }),
        ),
      ),
      Effect.scoped,
      Effect.runPromise,
    ))


  test.test("preserves non-Bun child scripts while de-duplicating Bun scripts", () =>
    Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/any/path`),
      )
      const html = yield* Effect.promise(() => response.text())
      const bunScriptCount = countBunDevScripts(html)

      test.expect(response.status).toBe(200)
      test.expect(bunScriptCount).toBe(1)
      test.expect(html).toContain('<script src="/assets/app.js"></script>')
      test.expect(html).toContain("<script>window.__app=1</script>")
    }).pipe(
      Effect.provide(
        testLayer(
          Route.tree({
            "*": Route.use(BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html"))),
            "/:path*": Route.get(
              BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html")),
              Route.html(
                '<section>Catch All</section><script src="/assets/app.js"></script><script>window.__app=1</script>',
              ),
            ),
          }),
        ),
      ),
      Effect.scoped,
      Effect.runPromise,
    ))


  test.test("preserves linked layout script without duplicating it", () =>
    Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/any/path`),
      )
      const html = yield* Effect.promise(() => response.text())
      const bunScriptCount = countBunDevScripts(html)
      const linkedScriptCount = countScriptsBySrc(html, "https://example.com/layout-shared.js")

      test.expect(response.status).toBe(200)
      test.expect(bunScriptCount).toBe(1)
      test.expect(linkedScriptCount).toBe(1)
      test.expect(html).toContain("https://example.com/layout-shared.js")
    }).pipe(
      Effect.provide(
        testLayer(
          Route.tree({
            "*": Route.use(BunRoute.htmlBundle(() => import("../../static/LayoutSlotsOuterScripts.html"))),
            "/:path*": Route.get(
              BunRoute.htmlBundle(() => import("../../static/LayoutSlotsInnerScripts.html")),
              Route.html("<section>Catch All</section>"),
            ),
          }),
        ),
      ),
      Effect.scoped,
      Effect.runPromise,
    ))

  test.test("does not include Bun dev scripts when development is false", () =>
    Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/any/path`),
      )
      const html = yield* Effect.promise(() => response.text())
      const bunScriptCount = countBunDevScripts(html)

      test.expect(response.status).toBe(200)
      test.expect(bunScriptCount).toBe(0)
    }).pipe(
      Effect.provide(
        testLayer(
          Route.tree({
            "*": Route.use(BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html"))),
            "/:path*": Route.get(
              BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html")),
              Route.html("<section>Catch All</section>"),
            ),
          }),
          { development: false },
        ),
      ),
      Effect.scoped,
      Effect.runPromise,
    ))

  test.test("includes Bun dev scripts when development is true", () =>
    Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/any/path`),
      )
      const html = yield* Effect.promise(() => response.text())
      const bunScriptCount = countBunDevScripts(html)

      test.expect(response.status).toBe(200)
      test.expect(bunScriptCount).toBe(1)
    }).pipe(
      Effect.provide(
        testLayer(
          Route.tree({
            "*": Route.use(BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html"))),
            "/:path*": Route.get(
              BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html")),
              Route.html("<section>Catch All</section>"),
            ),
          }),
          { development: true },
        ),
      ),
      Effect.scoped,
      Effect.runPromise,
    ))

  test.test("has format: html descriptor", () => {
    const routes = Route.tree({
      "/": Route.get(
        BunRoute.htmlBundle(() => import("../../static/LayoutSlots.html")),
        Route.html("<p>content</p>"),
      ),
    })

    return Effect.gen(function* () {
      const bunServer = yield* BunServer.BunServer
      const response = yield* Effect.promise(() =>
        fetch(`http://localhost:${bunServer.server.port}/`),
      )

      test.expect(response.status).toBe(200)
      test.expect(response.headers.get("content-type")).toContain("text/html")
    }).pipe(Effect.provide(testLayer(routes)), Effect.scoped, Effect.runPromise)
  })
})

test.describe(BunRoute.validateBunPattern, () => {
  test.test("returns none for valid patterns", () => {
    test.expect(Option.isNone(BunRoute.validateBunPattern("/users"))).toBe(true)
    test.expect(Option.isNone(BunRoute.validateBunPattern("/users/[id]"))).toBe(true)
    test.expect(Option.isNone(BunRoute.validateBunPattern("/[[rest]]"))).toBe(true)
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

test.describe(BunRoute.isHtmlBundle, () => {
  test.test("returns false for non-objects", () => {
    test.expect(BunRoute.isHtmlBundle(null)).toBe(false)
    test.expect(BunRoute.isHtmlBundle(undefined)).toBe(false)
    test.expect(BunRoute.isHtmlBundle("string")).toBe(false)
  })

  test.test("returns true for object with index property", () => {
    test.expect(BunRoute.isHtmlBundle({ index: "index.html" })).toBe(true)
  })
})
