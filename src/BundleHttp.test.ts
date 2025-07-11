import { HttpServerResponse } from "@effect/platform"
import { HttpRouter } from "@effect/platform"
import {
  expect,
  it,
  test,
} from "bun:test"
import { Effect } from "effect"
import {
  BunBundle,
  Bundle,
  BundleHttp,
  effectFn,
  TestHttpClient,
} from "effect-start"
import * as Layer from "effect/Layer"
import IndexHtml from "../static/react-dashboard.html" with { type: "file" }

const effect = effectFn(
  Layer.effect(
    Bundle.ClientBundle,
    BunBundle.buildClient(IndexHtml),
  ),
)

test("entrypoint with specific uri", () =>
  effect(function*() {
    const App = HttpRouter.empty.pipe(
      HttpRouter.get(
        "/react-dashboard",
        BundleHttp.entrypoint("../static/react-dashboard.html"),
      ),
    )
    const Client = TestHttpClient.make(App)

    const dashboardRes = yield* Client.get("/react-dashboard")
    expect(
      dashboardRes.status,
    )
      .toBe(200)
    expect(
      yield* dashboardRes.text,
    )
      .toStartWith("<!DOCTYPE html>")
  }))

test("entrypoint without uri parameter", () =>
  effect(function*() {
    const App = HttpRouter.empty.pipe(
      HttpRouter.get(
        "/",
        BundleHttp.entrypoint(),
      ),
      HttpRouter.get(
        "/index",
        BundleHttp.entrypoint(),
      ),
      HttpRouter.get(
        "/react-dashboard",
        BundleHttp.entrypoint(),
      ),
      HttpRouter.get(
        "/nonexistent",
        BundleHttp.entrypoint(),
      ),
    )
    const Client = TestHttpClient.make(App)

    const indexRes = yield* Client.get("/").pipe(
      Effect.catchTag(
        "RouteNotFound",
        () => HttpServerResponse.empty({ status: 404 }),
      ),
    )
    expect(
      indexRes.status,
    )
      .toBe(404)

    const indexPathRes = yield* Client.get("/index").pipe(
      Effect.catchTag(
        "RouteNotFound",
        () => HttpServerResponse.empty({ status: 404 }),
      ),
    )
    expect(
      indexPathRes.status,
    )
      .toBe(404)

    const dashboardRes = yield* Client.get("/react-dashboard")
    expect(
      dashboardRes.status,
    )
      .toBe(200)
    expect(
      yield* dashboardRes.text,
    )
      .toStartWith("<!DOCTYPE html>")

    const nonexistentRes = yield* Client.get("/nonexistent").pipe(
      Effect.catchTag(
        "RouteNotFound",
        () => HttpServerResponse.empty({ status: 404 }),
      ),
    )
    expect(
      nonexistentRes.status,
    )
      .toBe(404)
  }))

test("withEntrypoints middleware", () =>
  effect(function*() {
    const fallbackApp = Effect.succeed(
      HttpServerResponse.text("Fallback", { status: 404 }),
    )

    const App = BundleHttp.withEntrypoints()(fallbackApp)
    const Client = TestHttpClient.make(App)

    const rootRes = yield* Client.get("/")
    expect(
      rootRes.status,
    )
      .toBe(404)
    expect(
      yield* rootRes.text,
    )
      .toBe("Fallback")

    const dashboardRes = yield* Client.get("/react-dashboard")
    expect(
      dashboardRes.status,
    )
      .toBe(200)
    expect(
      yield* dashboardRes.text,
    )
      .toStartWith("<!DOCTYPE html>")

    const nonexistentRes = yield* Client.get("/nonexistent")
    expect(
      nonexistentRes.status,
    )
      .toBe(404)
    expect(
      yield* nonexistentRes.text,
    )
      .toBe("Fallback")
  }))
