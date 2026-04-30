import * as NPath from "node:path"
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as RouteTree from "effect-start/RouteTree"
import * as StaticFiles from "effect-start/StaticFiles"
import * as FileSystem from "../src/FileSystem.ts"
import * as NodeFileSystem from "../src/node/NodeFileSystem.ts"

test.it("serves files from the configured directory", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()

    yield* fs.makeDirectory(NPath.join(directory, "nested"))
    yield* fs.writeFileString(NPath.join(directory, "nested", "hello.txt"), "hello from assets")

    const runtime = yield* Effect.runtime<FileSystem.FileSystem>()
    const routes = StaticFiles.make(directory)
    const tree = RouteTree.make({ "/assets/:path+": routes })
    const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
    const handler = handles["/assets/:path+"]
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/assets/nested/hello.txt")

    test.expect(entity.status).toBe(200)
    test.expect(entity.headers["content-type"]).toBe("text/plain; charset=utf-8")
    test.expect(entity.headers["content-length"]).toBe(String("hello from assets".length))
    test.expect(yield* entity.text).toBe("hello from assets")
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer), Effect.runPromise),
)

test.it("returns 404 when the file does not exist", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()

    const runtime = yield* Effect.runtime<FileSystem.FileSystem>()
    const routes = StaticFiles.make(directory)
    const tree = RouteTree.make({ "/assets/:path+": routes })
    const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
    const handler = handles["/assets/:path+"]
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/assets/missing.txt")

    test.expect(entity.status).toBe(404)
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer), Effect.runPromise),
)

test.it("blocks directory traversal outside the configured directory", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()

    yield* fs.writeFileString(NPath.join(directory, "secret.txt"), "top secret")

    const runtime = yield* Effect.runtime<FileSystem.FileSystem>()
    const routes = StaticFiles.make(NPath.join(directory, "public"))
    const tree = RouteTree.make({ "/assets/:path+": routes })
    const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
    const handler = handles["/assets/:path+"]
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/assets/%2e%2e/secret.txt")

    test.expect(entity.status).toBe(404)
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer), Effect.runPromise),
)

test.it("supports mounting through StaticFiles.layer", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()

    yield* fs.writeFileString(NPath.join(directory, "app.css"), "body { color: red; }")

    yield* Effect.gen(function* () {
      const runtime = yield* Effect.runtime<Route.Routes | FileSystem.FileSystem>()
      const routes = yield* Route.Routes
      const handles = Object.fromEntries(RouteHttp.walkHandles(routes, runtime))
      const handler = handles["/public/:path+"]
      const client = Fetch.fromHandler(handler)
      const entity = yield* client.get("http://localhost/public/app.css")

      test.expect(entity.status).toBe(200)
      test.expect(entity.headers["content-type"]).toBe("text/css; charset=utf-8")
      test.expect(yield* entity.text).toContain("color: red")
    }).pipe(
      Effect.provide(
        StaticFiles.layer({
          directory,
          path: "public",
        }),
      ),
    )
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer), Effect.runPromise),
)

test.it("returns 404 when the path resolves to a directory", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()

    yield* fs.makeDirectory(NPath.join(directory, "nested"))
    yield* fs.writeFileString(NPath.join(directory, "nested", "hello.txt"), "hello")

    const runtime = yield* Effect.runtime<FileSystem.FileSystem>()
    const routes = StaticFiles.make(directory)
    const tree = RouteTree.make({ "/assets/:path+": routes })
    const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
    const handler = handles["/assets/:path+"]
    const client = Fetch.fromHandler(handler)
    const entity = yield* client.get("http://localhost/assets/nested")

    test.expect(entity.status).toBe(404)
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer), Effect.runPromise),
)

test.it("decodes URL-encoded characters in path params", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()

    yield* fs.writeFileString(NPath.join(directory, "hello world.txt"), "spaced")
    yield* fs.writeFileString(NPath.join(directory, "café.txt"), "unicode")

    const runtime = yield* Effect.runtime<FileSystem.FileSystem>()
    const routes = StaticFiles.make(directory)
    const tree = RouteTree.make({ "/assets/:path+": routes })
    const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
    const handler = handles["/assets/:path+"]
    const client = Fetch.fromHandler(handler)

    const spaced = yield* client.get("http://localhost/assets/hello%20world.txt")
    const unicode = yield* client.get("http://localhost/assets/caf%C3%A9.txt")

    test.expect(spaced.status).toBe(200)
    test.expect(yield* spaced.text).toBe("spaced")
    test.expect(unicode.status).toBe(200)
    test.expect(yield* unicode.text).toBe("unicode")
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer), Effect.runPromise),
)

test.it("detects javascript and source map content types", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()

    yield* fs.writeFileString(NPath.join(directory, "app.js"), "console.log('hi')")
    yield* fs.writeFileString(NPath.join(directory, "app.js.map"), "{}")

    const runtime = yield* Effect.runtime<FileSystem.FileSystem>()
    const routes = StaticFiles.make(directory)
    const tree = RouteTree.make({ "/assets/:path+": routes })
    const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
    const handler = handles["/assets/:path+"]
    const client = Fetch.fromHandler(handler)

    const js = yield* client.get("http://localhost/assets/app.js")
    const map = yield* client.get("http://localhost/assets/app.js.map")

    test.expect(js.status).toBe(200)
    test.expect(js.headers["content-type"]).toBe("text/javascript; charset=utf-8")
    test.expect(map.status).toBe(200)
    test.expect(map.headers["content-type"]).toBe("application/json")
  }).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer), Effect.runPromise),
)
