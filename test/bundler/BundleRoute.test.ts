import * as test from "bun:test"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Bundle from "../../src/bundler/Bundle.ts"
import * as BundleRoute from "../../src/bundler/BundleRoute.ts"
import * as Development from "../../src/Development.ts"

const testBundle: Bundle.BundleContext = {
  resolve: (url) => (url === "app.ts" ? "app-abc123.js" : undefined),
  getArtifact: (path) => {
    if (path === "app-abc123.js") {
      return new Blob(["console.log('hello')"], {
        type: "application/javascript",
      })
    }
    if (path === "style-def456.css") {
      return new Blob(["body{color:red}"], { type: "text/css" })
    }
    return undefined
  },
}

const testLayer = Layer.succeed(Bundle.Bundle, testBundle)

const makeRebuildableBundle = (): Bundle.BundleContext & {
  rebuildCount: number
} => {
  const context = {
    resolve: (url: string) => (url === "app.ts" ? "app-abc123.js" : undefined),
    getArtifact: (path: string) =>
      path === "app-abc123.js"
        ? new Blob(["console.log('hello')"], { type: "application/javascript" })
        : undefined,
    rebuildCount: 0,
    rebuild: () =>
      Effect.sync(() => {
        context.rebuildCount++
        return context
      }),
  }
  return context
}

test.it("serves a JS artifact", () =>
  Effect
    .gen(function*() {
      const runtime = yield* Effect.runtime<Bundle.Bundle>()
      const routes = BundleRoute.make(Bundle.Bundle)
      const tree = Route.map({ "/_bundle/:path+": routes })
      const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
      const handler = handles["/_bundle/:path+"]

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/_bundle/app-abc123.js")

      test
        .expect(entity.status)
        .toBe(200)
      test
        .expect(entity.headers)
        .toMatchObject({
          "content-type": test.expect.stringContaining("javascript"),
          "cache-control": "public, max-age=31536000, immutable",
        })
      test
        .expect(yield* entity.text)
        .toBe("console.log('hello')")
    })
    .pipe(
      Effect.provide(testLayer),
      Effect.runPromise,
    ))

test.it("serves a CSS artifact", () =>
  Effect
    .gen(function*() {
      const runtime = yield* Effect.runtime<Bundle.Bundle>()
      const routes = BundleRoute.make(Bundle.Bundle)
      const tree = Route.map({ "/_bundle/:path+": routes })
      const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
      const handler = handles["/_bundle/:path+"]

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get(
        "http://localhost/_bundle/style-def456.css",
      )

      test
        .expect(entity.status)
        .toBe(200)
      test
        .expect(entity.headers["content-type"])
        .toStartWith("text/css")
      test
        .expect(yield* entity.text)
        .toBe("body{color:red}")
    })
    .pipe(
      Effect.provide(testLayer),
      Effect.runPromise,
    ))

test.it("returns 404 for missing artifact", () =>
  Effect
    .gen(function*() {
      const runtime = yield* Effect.runtime<Bundle.Bundle>()
      const routes = BundleRoute.make(Bundle.Bundle)
      const tree = Route.map({ "/_bundle/:path+": routes })
      const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
      const handler = handles["/_bundle/:path+"]

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get(
        "http://localhost/_bundle/nonexistent.js",
      )

      test
        .expect(entity.status)
        .toBe(404)
    })
    .pipe(
      Effect.provide(testLayer),
      Effect.runPromise,
    ))

test.it("does not rebuild on GET outside of Development", () => {
  const rebuildable = makeRebuildableBundle()

  return Effect
    .gen(function*() {
      const runtime = yield* Effect.runtime<Bundle.Bundle>()
      const routes = BundleRoute.make(Bundle.Bundle)
      const tree = Route.map({ "/_bundle/:path+": routes })
      const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
      const handler = handles["/_bundle/:path+"]

      const client = Fetch.fromHandler(handler)
      yield* client.get("http://localhost/_bundle/app-abc123.js")
      yield* client.get("http://localhost/_bundle/app-abc123.js")

      test
        .expect(rebuildable.rebuildCount)
        .toBe(0)
    })
    .pipe(
      Effect.provide(Layer.succeed(Bundle.Bundle, rebuildable)),
      Effect.runPromise,
    )
})

test.it("rebuilds on GET when Development is in context", () => {
  const rebuildable = makeRebuildableBundle()

  return Effect
    .gen(function*() {
      const runtime = yield* Effect.runtime<Bundle.Bundle>()
      const routes = BundleRoute.make(Bundle.Bundle)
      const tree = Route.map({ "/_bundle/:path+": routes })
      const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
      const handler = handles["/_bundle/:path+"]

      const client = Fetch.fromHandler(handler)
      yield* client.get("http://localhost/_bundle/app-abc123.js")
      yield* client.get("http://localhost/_bundle/app-abc123.js")

      test
        .expect(rebuildable.rebuildCount)
        .toBe(2)
    })
    .pipe(
      Effect.provide(Layer.succeed(Bundle.Bundle, rebuildable)),
      Effect.provide(Development.layerTest),
      Effect.runPromise,
    )
})

test.it("supports custom mount path", () =>
  Effect
    .gen(function*() {
      const runtime = yield* Effect.runtime<Bundle.Bundle>()
      const routes = BundleRoute.make(Bundle.Bundle)
      const tree = Route.map({ "/assets/:path+": routes })
      const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
      const handler = handles["/assets/:path+"]

      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/assets/app-abc123.js")

      test
        .expect(entity.status)
        .toBe(200)
      test
        .expect(yield* entity.text)
        .toBe("console.log('hello')")
    })
    .pipe(
      Effect.provide(testLayer),
      Effect.runPromise,
    ))
