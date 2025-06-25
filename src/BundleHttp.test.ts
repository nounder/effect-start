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
  BundleHttp,
  effectFn,
  TestHttpClient,
} from "effect-bundler"
import IndexHtml from "../static/react-dashboard.html" with { type: "file" }

const effect = effectFn(
  BunBundle
    .bundleClient({
      entrypoints: [
        IndexHtml,
      ],
    })
    .layer,
)

test("entrypoint", () => {
  effect(function*() {
    const App = HttpRouter.empty.pipe(
      HttpRouter.get(
        "/",
        BundleHttp.entrypoint(),
      ),
      HttpRouter.get(
        "/react-dashboard",
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

    const dashboardRes = yield* Client.get("/react-dashboard")
    expect(
      dashboardRes.status,
    )
      .toBe(200)
    expect(
      yield* dashboardRes.text,
    )
      .toStartWith("<!DOCTYPE html>")
  })
})

test("withAssets middleware", () => {
  effect(function*() {
    const App = HttpRouter.empty.pipe(
      HttpRouter.get(
        "/hello",
        HttpServerResponse.text("Hello World!"),
      ),
      HttpRouter.use(BundleHttp.withAssets()),
    )
    const Client = TestHttpClient.make(App)

    const manifestRes = yield* Client.get("/_bundle/manifest.json")
    expect(
      manifestRes.status,
    )
      .toBe(200)

    const manifestData = yield* manifestRes.json
    expect(
      manifestData,
    )
      .toHaveProperty("entrypoints")
    expect(
      manifestData,
    )
      .toHaveProperty("artifacts")
  })
})

test("withAssets middleware with custom path", () => {
  effect(function*() {
    const App = HttpRouter.empty.pipe(
      HttpRouter.get(
        "/hello",
        HttpServerResponse.text("Hello World!"),
      ),
      HttpRouter.use(BundleHttp.withAssets({ path: "/assets" })),
    )
    const Client = TestHttpClient.make(App)

    const manifestRes = yield* Client.get("/assets/manifest.json")
    expect(
      manifestRes.status,
    )
      .toBe(200)
  })
})

test("withEntrypoints middleware", () => {
  effect(function*() {
    const App = HttpRouter.empty.pipe(
      HttpRouter.get(
        "/hello",
        HttpServerResponse.text("Hello World!"),
      ),
      HttpRouter.use(BundleHttp.withEntrypoints()),
    )
    const Client = TestHttpClient.make(App)

    const entrypointRes = yield* Client.get("/react-dashboard")
    expect(
      entrypointRes.status,
    )
      .toBe(200)
    expect(
      yield* entrypointRes.text,
    )
      .toStartWith("<!DOCTYPE html>")
  })
})

test("withBundle middleware", () => {
  effect(function*() {
    const App = HttpRouter.empty.pipe(
      HttpRouter.get(
        "/hello",
        HttpServerResponse.text("Hello World!"),
      ),
      HttpRouter.use(BundleHttp.withBundle()),
    )
    const Client = TestHttpClient.make(App)

    const manifestRes = yield* Client.get("/_bundle/manifest.json")
    expect(
      manifestRes.status,
    )
      .toBe(200)

    const entrypointRes = yield* Client.get("/react-dashboard")
    expect(
      entrypointRes.status,
    )
      .toBe(200)
    expect(
      yield* entrypointRes.text,
    )
      .toStartWith("<!DOCTYPE html>")
  })
})
