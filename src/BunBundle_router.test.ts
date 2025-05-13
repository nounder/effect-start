import { HttpRouter, HttpServerResponse } from "@effect/platform"
import { expect, it } from "bun:test"
import * as BunBundle from "./bun/BunBundle.ts"
import * as Bundle from "./Bundle"
import { effectFn } from "./testing.ts"

const effect = effectFn()

const ReactDashboardHtmlUrl = import.meta.resolve(
  "../samples/react-dashboard.html",
)

const Router = HttpRouter.empty.pipe(
  HttpRouter.get(
    "/",
    HttpServerResponse.redirect("/dashboard"),
  ),
  HttpRouter.get(
    "/dashboard",
    Bundle.httpEntrypoint(ReactDashboardHtmlUrl),
  ),
  HttpRouter.get(
    "/hello",
    HttpServerResponse.text("Hello World!"),
  ),
  HttpRouter.mountApp(
    "/_bundle",
    Bundle.httpBundle(),
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
