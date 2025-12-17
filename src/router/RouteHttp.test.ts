import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as BunHttpServer from "../bun/BunHttpServer.ts"
import * as Route from "./Route.ts"
import * as RouteHttp from "./RouteHttp.ts"
import * as RouteSet from "./RouteSet.ts"

function runWithBunHttpServer<A, E>(
  effect: Effect.Effect<A, E, BunHttpServer.BunHttpServer>,
): Promise<A> {
  return Effect.runPromise(
    effect.pipe(Effect.provide(BunHttpServer.layer({ port: 0 }))),
  )
}

test.describe("RouteHttp.matchKind", () => {
  test.describe(
    "empty accept header (wildcard priority: json > text > html)",
    () => {
      test.it("returns JSON route when available", () => {
        const routes = Route.html("html").text("text").json({ data: "json" })
        const result = RouteHttp.matchKind(routes, "")
        test
          .expect(result?.kind)
          .toBe("json")
      })

      test.it("returns text route when no JSON", () => {
        const routes = Route.html("html").text("text")
        const result = RouteHttp.matchKind(routes, "")
        test
          .expect(result?.kind)
          .toBe("text")
      })

      test.it("returns HTML route when no JSON or text", () => {
        const routes = Route.html("html")
        const result = RouteHttp.matchKind(routes, "")
        test
          .expect(result?.kind)
          .toBe("html")
      })
    },
  )

  test.describe("explicit accept header", () => {
    test.it("returns JSON when Accept: application/json", () => {
      const routes = Route.html("html").json({ data: "json" }).text("text")
      const result = RouteHttp.matchKind(routes, "application/json")
      test
        .expect(result?.kind)
        .toBe("json")
    })

    test.it("returns text when Accept: text/plain", () => {
      const routes = Route.html("html").json({ data: "json" }).text("text")
      const result = RouteHttp.matchKind(routes, "text/plain")
      test
        .expect(result?.kind)
        .toBe("text")
    })

    test.it("returns HTML when Accept: text/html", () => {
      const routes = Route.json({ data: "json" }).html("html").text("text")
      const result = RouteHttp.matchKind(routes, "text/html")
      test
        .expect(result?.kind)
        .toBe("html")
    })
  })

  test.describe("quality values", () => {
    test.it("respects quality values - prefers higher q", () => {
      const routes = Route.html("html").json({ data: "json" })
      const result = RouteHttp.matchKind(
        routes,
        "text/html;q=0.9, application/json;q=1.0",
      )
      test
        .expect(result?.kind)
        .toBe("json")
    })

    test.it("prefers HTML when HTML has higher q", () => {
      const routes = Route.html("html").json({ data: "json" })
      const result = RouteHttp.matchKind(
        routes,
        "text/html;q=1.0, application/json;q=0.5",
      )
      test
        .expect(result?.kind)
        .toBe("html")
    })

    test.it("default q=1.0 when not specified", () => {
      const routes = Route.html("html").json({ data: "json" })
      const result = RouteHttp.matchKind(
        routes,
        "text/html;q=0.9, application/json",
      )
      test
        .expect(result?.kind)
        .toBe("json")
    })
  })

  test.describe("wildcards", () => {
    test.it("*/* uses priority order (json > text > html)", () => {
      const routes = Route.html("html").text("text").json({ data: "json" })
      const result = RouteHttp.matchKind(routes, "*/*")
      test
        .expect(result?.kind)
        .toBe("json")
    })

    test.it("text/* matches text first (by priority)", () => {
      const routes = Route.json({ data: "json" }).html("html").text("text")
      const result = RouteHttp.matchKind(routes, "text/*")
      test
        .expect(result?.kind)
        .toBe("text")
    })
  })

  test.describe("fallback behavior", () => {
    test.it("returns first route when no match", () => {
      const routes = Route.json({ data: "json" }).text("text")
      const result = RouteHttp.matchKind(routes, "image/png")
      test
        .expect(result?.kind)
        .toBe("json")
    })

    test.it("returns undefined for empty routes", () => {
      const routes = RouteSet.make()
      const result = RouteHttp.matchKind(routes, "application/json")
      test
        .expect(result)
        .toBeUndefined()
    })
  })

  test.describe("specificity", () => {
    test.it("prefers exact match over wildcard", () => {
      const routes = Route.html("html").json({ data: "json" })
      const result = RouteHttp.matchKind(
        routes,
        "text/*, application/json",
      )
      test
        .expect(result?.kind)
        .toBe("json")
    })
  })
})

test.describe("RouteHttp.toWebHandler", () => {
  test.describe("basic route rendering", () => {
    test.it("renders text route", async () => {
      const routes = Route.text("Hello World")
      const routes2 = Route.text(function*() {
        return "Hello World"
      })

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      test
        .expect(response.status)
        .toBe(200)
      test
        .expect(await response.text())
        .toBe("Hello World")
      test
        .expect(response.headers.get("content-type"))
        .toContain("text/plain")
    })

    test.it("renders json route", async () => {
      const routes = Route.json({ message: "ok", count: 42 })

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      test
        .expect(response.status)
        .toBe(200)
      test
        .expect(await response.json())
        .toEqual({ message: "ok", count: 42 })
      test
        .expect(response.headers.get("content-type"))
        .toContain("application/json")
    })

    test.it("renders html route", async () => {
      const routes = Route.html("<h1>Title</h1>")

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      test
        .expect(response.status)
        .toBe(200)
      test
        .expect(await response.text())
        .toBe("<h1>Title</h1>")
      test
        .expect(response.headers.get("content-type"))
        .toContain("text/html")
    })
  })

  test.describe("content negotiation", () => {
    test.it("selects route based on Accept header", async () => {
      const routes = Route.text("text response").json({ type: "json" })

      const webHandler = RouteHttp.toWebHandler(routes)

      const jsonResponse = await webHandler(
        new Request("http://localhost/test", {
          headers: { Accept: "application/json" },
        }),
      )
      test
        .expect(await jsonResponse.json())
        .toEqual({ type: "json" })

      const textResponse = await webHandler(
        new Request("http://localhost/test", {
          headers: { Accept: "text/plain" },
        }),
      )
      test
        .expect(await textResponse.text())
        .toBe("text response")
    })

    test.it("returns 406 when routes are empty", async () => {
      const routes = RouteSet.make()
      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      test
        .expect(response.status)
        .toBe(406)
    })

    test.it("falls back to first route when no Accept match", async () => {
      const routes = Route.json({ data: 1 })

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(
        new Request("http://localhost/test", {
          headers: { Accept: "image/png" },
        }),
      )

      test
        .expect(response.status)
        .toBe(200)
      test
        .expect(await response.json())
        .toEqual({ data: 1 })
    })

    test.it("uses wildcard priority when Accept is */*", async () => {
      const routes = Route.html("<p>html</p>").json({ type: "json" })

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(
        new Request("http://localhost/test", {
          headers: { Accept: "*/*" },
        }),
      )

      test
        .expect(await response.json())
        .toEqual({ type: "json" })
    })
  })

  test.describe("toHttpApp with middleware", () => {
    test.it("allows middleware to be applied to httpApp", async () => {
      const routes = Route.text("content")

      const addHeader = HttpMiddleware.make((app) =>
        Effect.gen(function*() {
          const response = yield* app
          return HttpServerResponse.setHeader(response, "X-Custom", "value")
        })
      )

      const httpApp = addHeader(RouteHttp.toHttpApp(routes))
      const webHandler = HttpApp.toWebHandler(httpApp)

      const response = await webHandler(new Request("http://localhost/test"))

      test
        .expect(response.headers.get("X-Custom"))
        .toBe("value")
      test
        .expect(await response.text())
        .toBe("content")
    })
  })

  test.describe("error handling", () => {
    test.it("catches handler errors and returns error response", async () => {
      const routes = Route.json(Effect.fail(new Error("Something went wrong")))

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      test
        .expect(response.status)
        .toBe(500)
    })
  })

  test.describe("toWebHandlerRuntime", () => {
    test.it("uses provided runtime", async () => {
      const routes = Route.text("with runtime")

      const runtime = await runWithBunHttpServer(
        Effect.runtime<BunHttpServer.BunHttpServer>(),
      )

      const webHandler = RouteHttp.toWebHandlerRuntime(runtime)(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      test
        .expect(await response.text())
        .toBe("with runtime")
    })
  })
})
