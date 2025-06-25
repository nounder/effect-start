import {
  HttpRouter,
  HttpServerResponse,
} from "@effect/platform"
import {
  describe,
  expect,
  test,
} from "bun:test"
import { fileURLToPath } from "node:url"
import * as BundleHttp from "../BundleHttp.ts"
import { TestHttpClient } from "../index.ts"
import { effectFn } from "../testing.ts"
import * as BunBundle from "./BunBundle.ts"

const HtmlPath = fileURLToPath(import.meta.resolve(
  "../../static/react-dashboard.html",
))

describe("explicit bundle route", () => {
  const Router = HttpRouter.empty.pipe(
    HttpRouter.get(
      "/dashboard",
      BundleHttp.entrypoint(HtmlPath),
    ),
    HttpRouter.mountApp(
      "/_bundle",
      BundleHttp.httpApp(),
    ),
    HttpRouter.get(
      "/hello",
      HttpServerResponse.text("Hello World!"),
    ),
  )

  const effect = effectFn(
    BunBundle
      .bundleClient({
        ...BunBundle.configFromHttpRouter(Router),
      })
      .layer,
  )

  const Client = TestHttpClient.make(Router)

  test("fromHttpRouter", () =>
    effect(function*() {
      const config = BunBundle.configFromHttpRouter(Router)

      expect(
        config,
      )
        .toMatchObject({
          entrypoints: [
            HtmlPath,
          ],
          publicPath: "/_bundle/",
        })
    }))

  test("responses", () =>
    effect(function*() {
      {
        const res = yield* Client.get("/_bundle/manifest.json")

        expect(
          res.status,
        )
          .toBe(200)
      }

      {
        const res = yield* Client.get("/hello")

        expect(
          res.status,
        )
          .toBe(200)

        expect(
          yield* res.text,
        )
          .toBe("Hello World!")
      }
    }))
})

describe("implicit bundle route", () => {
  const Router = HttpRouter.empty.pipe(
    HttpRouter.get(
      "/dashboard",
      BundleHttp.entrypoint(HtmlPath),
    ),
  )

  const effect = effectFn(
    BunBundle
      .bundleClient({
        ...BunBundle.configFromHttpRouter(Router),
      })
      .layer,
  )

  const Client = TestHttpClient.make(Router)

  test("fromHttpRouter", () =>
    effect(function*() {
      const config = BunBundle.configFromHttpRouter(Router)

      expect(
        config,
      )
        .toMatchObject({
          entrypoints: [
            HtmlPath,
          ],
          publicPath: undefined,
        })
    }))

  test("responses", () =>
    effect(function*() {
      const res = yield* Client.get("/_bundle/manifest.json")

      expect(
        res.status,
      )
        .toBe(404)
    }))
})
