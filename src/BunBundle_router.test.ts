import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { expect, it } from "bun:test"
import * as BunBundle from "./bun/BunBundle.ts"
import * as BundleHttp from "./BundleHttp.ts"
import { effectFn } from "./testing.ts"

const effect = effectFn()

const Router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/dashboard",
    BundleHttp.handleEntrypoint(import.meta.resolve(
      "../samples/react-dashboard.html",
    )),
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

it("fromHttpRouter", () =>
  effect(function*() {
    const config = BunBundle.configFromHttpRouter(Router)

    expect(config).toMatchObject({
      entrypoints: [
        "/dashboard",
      ],
      publicPath: "/_bundle",
    })
  }))
