import { HttpServerResponse } from "@effect/platform"
import {
  expect,
  test,
} from "bun:test"
import { Effect } from "effect"
import { MemoryFileSystem } from "effect-memfs"
import {
  effectFn,
  TestHttpClient,
} from "effect-start"
import * as PublicDirectory from "./PublicDirectory.ts"

const TestFiles = {
  "/test-public/index.html": "<html><body>Hello World</body></html>",
  "/test-public/style.css": "body { color: red; }",
  "/test-public/script.js": "console.log('hello');",
  "/test-public/data.json": "{\"message\": \"test\"}",
  "/test-public/image.png": "fake-png-data",
  "/test-public/nested/file.txt": "nested content",
}

const effect = effectFn()

test("serves index.html for root path", () => {
  effect(function*() {
    const app = PublicDirectory.make({ directory: "/test-public" })
    const Client = TestHttpClient.make(app)

    const res = yield* Client.get("/").pipe(
      Effect.provide(MemoryFileSystem.layerWith(TestFiles)),
    )

    expect(
      res.status,
    )
      .toBe(200)

    const body = yield* res.text
    expect(
      body,
    )
      .toBe("<html><body>Hello World</body></html>")

    expect(
      res.headers["content-type"],
    )
      .toBe("text/html")
  })
})

test("serves CSS files with correct content type", () => {
  effect(function*() {
    const app = PublicDirectory.make({ directory: "/test-public" })
    const Client = TestHttpClient.make(app)

    const res = yield* Client.get("/style.css").pipe(
      Effect.provide(MemoryFileSystem.layerWith(TestFiles)),
    )

    expect(
      res.status,
    )
      .toBe(200)

    const body = yield* res.text
    expect(
      body,
    )
      .toBe("body { color: red; }")

    expect(
      res.headers["content-type"],
    )
      .toBe("text/css")
  })
})

test("serves JavaScript files with correct content type", () => {
  effect(function*() {
    const app = PublicDirectory.make({ directory: "/test-public" })
    const Client = TestHttpClient.make(app)

    const res = yield* Client.get("/script.js").pipe(
      Effect.provide(MemoryFileSystem.layerWith(TestFiles)),
    )

    expect(
      res.status,
    )
      .toBe(200)

    const body = yield* res.text
    expect(
      body,
    )
      .toBe("console.log('hello');")

    expect(
      res.headers["content-type"],
    )
      .toBe("application/javascript")
  })
})

test("serves JSON files with correct content type", () => {
  effect(function*() {
    const app = PublicDirectory.make({ directory: "/test-public" })
    const Client = TestHttpClient.make(app)

    const res = yield* Client.get("/data.json").pipe(
      Effect.provide(MemoryFileSystem.layerWith(TestFiles)),
    )

    expect(
      res.status,
    )
      .toBe(200)

    const body = yield* res.text
    expect(
      body,
    )
      .toBe("{\"message\": \"test\"}")

    expect(
      res.headers["content-type"],
    )
      .toBe("application/json")
  })
})

test("serves nested files", () => {
  effect(function*() {
    const app = PublicDirectory.make({ directory: "/test-public" })
    const Client = TestHttpClient.make(app)

    const res = yield* Client.get("/nested/file.txt").pipe(
      Effect.provide(MemoryFileSystem.layerWith(TestFiles)),
    )

    expect(
      res.status,
    )
      .toBe(200)

    const body = yield* res.text
    expect(
      body,
    )
      .toBe("nested content")

    expect(
      res.headers["content-type"],
    )
      .toBe("text/plain")
  })
})

test("returns 404 for non-existent files", () => {
  effect(function*() {
    const app = PublicDirectory.make({ directory: "/test-public" })
    const Client = TestHttpClient.make(app)

    const res = yield* Client.get("/nonexistent.txt").pipe(
      Effect.provide(MemoryFileSystem.layerWith(TestFiles)),
      Effect.catchTag(
        "RouteNotFound",
        () => HttpServerResponse.empty({ status: 404 }),
      ),
    )

    expect(
      res.status,
    )
      .toBe(404)
  })
})

test("prevents directory traversal attacks", () => {
  effect(function*() {
    const app = PublicDirectory.make({ directory: "/test-public" })
    const Client = TestHttpClient.make(app)

    const res = yield* Client.get("/../../../etc/passwd").pipe(
      Effect.provide(MemoryFileSystem.layerWith(TestFiles)),
      Effect.catchTag(
        "RouteNotFound",
        () => HttpServerResponse.empty({ status: 404 }),
      ),
    )

    expect(
      res.status,
    )
      .toBe(404)
  })
})

test("works with custom prefix", () => {
  effect(function*() {
    const app = PublicDirectory.make({
      directory: "/test-public",
      prefix: "/static",
    })
    const Client = TestHttpClient.make(app)

    const res = yield* Client.get("/static/style.css").pipe(
      Effect.provide(MemoryFileSystem.layerWith(TestFiles)),
    )

    expect(
      res.status,
    )
      .toBe(200)

    const body = yield* res.text
    expect(
      body,
    )
      .toBe("body { color: red; }")
  })
})

test("ignores requests without prefix when prefix is set", () => {
  effect(function*() {
    const app = PublicDirectory.make({
      directory: "/test-public",
      prefix: "/static",
    })
    const Client = TestHttpClient.make(app)

    const res = yield* Client.get("/style.css").pipe(
      Effect.provide(MemoryFileSystem.layerWith(TestFiles)),
      Effect.catchTag(
        "RouteNotFound",
        () => HttpServerResponse.empty({ status: 404 }),
      ),
    )

    expect(
      res.status,
    )
      .toBe(404)
  })
})

test("sets cache control headers", () => {
  effect(function*() {
    const app = PublicDirectory.make({ directory: "/test-public" })
    const Client = TestHttpClient.make(app)

    const res = yield* Client.get("/style.css").pipe(
      Effect.provide(MemoryFileSystem.layerWith(TestFiles)),
    )

    expect(
      res.headers["cache-control"],
    )
      .toBe("public, max-age=3600")
  })
})
