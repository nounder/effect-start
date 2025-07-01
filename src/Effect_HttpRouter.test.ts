/**
 * This file tests `@effect/platform/HttpRouter`, not our code.
 * Since Platform code is still unstable and we relay heavily on its
 * chaining/fallback behavior in `BundleHttp` & `FileHttpRouter`.
 * We want to ensure the behavior doesn't change across versions.
 */
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import {
  expect,
  test,
} from "bun:test"
import * as Effect from "effect/Effect"
import * as TestHttpClient from "../src/TestHttpClient.ts"
import { effectFn } from "../src/testing.ts"

const effect = effectFn()

test("Single app mounted on path", () =>
  effect(function*() {
    const app1 = HttpRouter.empty.pipe(
      HttpRouter.get("/hello", HttpServerResponse.text("Hello from app1")),
    )

    const router = HttpRouter.empty.pipe(
      HttpRouter.mount("/api", app1),
    )

    const client = TestHttpClient.make(router)
    const response = yield* client.get("/api/hello")

    expect(response.status)
      .toBe(200)

    expect(yield* response.text)
      .toBe("Hello from app1")
  }))

test("Multiple apps mounted on same path chain together", () =>
  effect(function*() {
    const app1 = HttpRouter.empty.pipe(
      HttpRouter.get("/hello", HttpServerResponse.text("Hello from app1")),
    )

    const app2 = HttpRouter.empty.pipe(
      HttpRouter.get("/world", HttpServerResponse.text("World from app2")),
    )

    const router = HttpRouter.empty.pipe(
      HttpRouter.mount("/api", app1),
      HttpRouter.mount("/api", app2),
    )

    const client = TestHttpClient.make(router)

    const response1 = yield* client.get("/api/hello")

    expect(response1.status)
      .toBe(200)

    expect(yield* response1.text)
      .toBe("Hello from app1")

    const response2 = yield* client.get("/api/world")

    expect(response2.status)
      .toBe(200)

    expect(yield* response2.text)
      .toBe("World from app2")
  }))

test("First app returns 404 - second app should be called", () =>
  effect(function*() {
    const app1 = HttpRouter.empty.pipe(
      HttpRouter.get("/hello", HttpServerResponse.text("Hello from app1")),
    )

    const app2 = HttpRouter.empty.pipe(
      HttpRouter.get("/missing", HttpServerResponse.text("Found in app2")),
    )

    const router = HttpRouter.empty.pipe(
      HttpRouter.mount("/api", app1),
      HttpRouter.mount("/api", app2),
    )

    const client = TestHttpClient.make(router)
    const response = yield* client.get("/api/missing")

    expect(response.status)
      .toBe(200)

    expect(yield* response.text)
      .toBe("Found in app2")
  }))

test("First app has no matching route - second app should be called", () =>
  effect(function*() {
    const app1 = HttpRouter.empty.pipe(
      HttpRouter.get("/specific", HttpServerResponse.text("Specific route")),
    )

    const app2 = HttpRouter.empty.pipe(
      HttpRouter.get("/different", HttpServerResponse.text("Different route")),
    )

    const router = HttpRouter.empty.pipe(
      HttpRouter.mount("/api", app1),
      HttpRouter.mount("/api", app2),
    )

    const client = TestHttpClient.make(router)
    const response = yield* client.get("/api/different")

    expect(response.status)
      .toBe(200)

    expect(yield* response.text)
      .toBe("Different route")
  }))

test("Multiple mounts with different methods", () =>
  effect(function*() {
    const app1 = HttpRouter.empty.pipe(
      HttpRouter.get("/data", HttpServerResponse.text("GET data")),
    )

    const app2 = HttpRouter.empty.pipe(
      HttpRouter.post("/data", HttpServerResponse.text("POST data")),
    )

    const router = HttpRouter.empty.pipe(
      HttpRouter.mount("/api", app1),
      HttpRouter.mount("/api", app2),
    )

    const client = TestHttpClient.make(router)

    const getResponse = yield* client.get("/api/data")

    expect(getResponse.status)
      .toBe(200)

    expect(yield* getResponse.text)
      .toBe("GET data")

    const postResponse = yield* client.post("/api/data")

    expect(postResponse.status)
      .toBe(200)

    expect(yield* postResponse.text)
      .toBe("POST data")
  }))
