import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Bundle from "../../src/bundler/Bundle.ts"
import * as BundleRoute from "../../src/bundler/BundleRoute.ts"
import * as Fetch from "effect-start/Fetch"
import * as RouteHttp from "effect-start/RouteHttp"
import * as RouteTree from "effect-start/RouteTree"

const testBundle: Bundle.BundleContext = {
  entrypoints: {
    "app.ts": "app-abc123.js",
  },
  artifacts: [
    { path: "app-abc123.js", type: "application/javascript", size: 20 },
    { path: "style-def456.css", type: "text/css", size: 10 },
  ],
  resolve: (url) => (url === "app.ts" ? "app-abc123.js" : null),
  getArtifact: (path) => {
    if (path === "app-abc123.js") {
      return new Blob(["console.log('hello')"], { type: "application/javascript" })
    }
    if (path === "style-def456.css") {
      return new Blob(["body{color:red}"], { type: "text/css" })
    }
    return null
  },
}

const testLayer = Layer.succeed(Bundle.ClientBundle, testBundle)

test.it("serves a JS artifact", () =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<Bundle.ClientBundle>()
    const routes = BundleRoute.make(Bundle.ClientBundle)
    const tree = RouteTree.make({ "/_bundle/:path+": routes })
    const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
    const handler = handles["/_bundle/:path+"]

    const response = yield* Effect.promise(() =>
      Fetch.fromHandler(handler, { path: "/_bundle/app-abc123.js" }),
    )

    test.expect(response.status).toBe(200)
    test.expect(response.headers.get("content-type")).toContain("javascript")
    test.expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
    test.expect(yield* Effect.promise(() => response.text())).toBe("console.log('hello')")
  }).pipe(Effect.provide(testLayer), Effect.runPromise),
)

test.it("serves a CSS artifact", () =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<Bundle.ClientBundle>()
    const routes = BundleRoute.make(Bundle.ClientBundle)
    const tree = RouteTree.make({ "/_bundle/:path+": routes })
    const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
    const handler = handles["/_bundle/:path+"]

    const response = yield* Effect.promise(() =>
      Fetch.fromHandler(handler, { path: "/_bundle/style-def456.css" }),
    )

    test.expect(response.status).toBe(200)
    test.expect(response.headers.get("content-type")).toStartWith("text/css")
    test.expect(yield* Effect.promise(() => response.text())).toBe("body{color:red}")
  }).pipe(Effect.provide(testLayer), Effect.runPromise),
)

test.it("returns 404 for missing artifact", () =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<Bundle.ClientBundle>()
    const routes = BundleRoute.make(Bundle.ClientBundle)
    const tree = RouteTree.make({ "/_bundle/:path+": routes })
    const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
    const handler = handles["/_bundle/:path+"]

    const response = yield* Effect.promise(() =>
      Fetch.fromHandler(handler, { path: "/_bundle/nonexistent.js" }),
    )

    test.expect(response.status).toBe(404)
  }).pipe(Effect.provide(testLayer), Effect.runPromise),
)

test.it("supports custom mount path", () =>
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<Bundle.ClientBundle>()
    const routes = BundleRoute.make(Bundle.ClientBundle)
    const tree = RouteTree.make({ "/assets/:path+": routes })
    const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
    const handler = handles["/assets/:path+"]

    const response = yield* Effect.promise(() =>
      Fetch.fromHandler(handler, { path: "/assets/app-abc123.js" }),
    )

    test.expect(response.status).toBe(200)
    test.expect(yield* Effect.promise(() => response.text())).toBe("console.log('hello')")
  }).pipe(Effect.provide(testLayer), Effect.runPromise),
)
