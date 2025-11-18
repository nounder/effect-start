import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import {
  Bundle,
  BundleHttp,
  effectFn,
  TestHttpClient,
} from "effect-start"
import * as Layer from "effect/Layer"
import IndexHtml from "../static/react-dashboard.html" with { type: "file" }
import * as BunBundle from "./bun/BunBundle.ts"

const effect = effectFn(
  Layer.effect(
    Bundle.ClientBundle,
    BunBundle.buildClient(IndexHtml),
  ),
)

t.it("entrypoint with specific uri", () =>
  effect(function*() {
    const App = HttpRouter.empty.pipe(
      HttpRouter.get(
        "/react-dashboard",
        BundleHttp.entrypoint("../static/react-dashboard.html"),
      ),
    )
    const Client = TestHttpClient.make(App)

    const dashboardRes = yield* Client.get("/react-dashboard")
    t
      .expect(
      dashboardRes.status,
    )
      .toBe(200)
    t
      .expect(
      yield* dashboardRes.text,
    )
      .toStartWith("<!DOCTYPE html>")
  }))

t.it("entrypoint without uri parameter", () =>
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
    t
      .expect(
      indexRes.status,
    )
      .toBe(404)

    const indexPathRes = yield* Client.get("/index").pipe(
      Effect.catchTag(
        "RouteNotFound",
        () => HttpServerResponse.empty({ status: 404 }),
      ),
    )
    t
      .expect(
      indexPathRes.status,
    )
      .toBe(404)

    const dashboardRes = yield* Client.get("/react-dashboard")
    t
      .expect(
      dashboardRes.status,
    )
      .toBe(200)
    t
      .expect(
      yield* dashboardRes.text,
    )
      .toStartWith("<!DOCTYPE html>")

    const nonexistentRes = yield* Client.get("/nonexistent").pipe(
      Effect.catchTag(
        "RouteNotFound",
        () => HttpServerResponse.empty({ status: 404 }),
      ),
    )
    t
      .expect(
      nonexistentRes.status,
    )
      .toBe(404)
  }))

t.it("withEntrypoints middleware", () =>
  effect(function*() {
    const fallbackApp = Effect.succeed(
      HttpServerResponse.text("Fallback", { status: 404 }),
    )

    const App = BundleHttp.withEntrypoints()(fallbackApp)
    const Client = TestHttpClient.make(App)

    const rootRes = yield* Client.get("/")
    t
      .expect(
      rootRes.status,
    )
      .toBe(404)
    t
      .expect(
      yield* rootRes.text,
    )
      .toBe("Fallback")

    const dashboardRes = yield* Client.get("/react-dashboard")
    t
      .expect(
      dashboardRes.status,
    )
      .toBe(200)
    t
      .expect(
      yield* dashboardRes.text,
    )
      .toStartWith("<!DOCTYPE html>")

    const nonexistentRes = yield* Client.get("/nonexistent")
    t
      .expect(
      nonexistentRes.status,
    )
      .toBe(404)
    t
      .expect(
      yield* nonexistentRes.text,
    )
      .toBe("Fallback")
  }))
