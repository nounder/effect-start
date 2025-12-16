import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as BunHttpServer from "./bun/BunHttpServer.ts"
import * as Route from "./Route.ts"
import * as RouteHttp from "./RouteHttp.ts"
import * as Router from "./Router.ts"
import * as RouteSet from "./RouteSet.ts"

function runWithBunHttpServer<A, E>(
  effect: Effect.Effect<A, E, BunHttpServer.BunHttpServer>,
): Promise<A> {
  return Effect.runPromise(
    effect.pipe(Effect.provide(BunHttpServer.layer({ port: 0 }))),
  )
}

t.describe("Router.matchMedia", () => {
  t.describe(
    "empty accept header (wildcard priority: json > text > html)",
    () => {
      t.it("returns JSON route when available", () => {
        const routes = Route.html("html").text("text").json({ data: "json" })
        const result = Router.matchMedia(routes, "")
        t.expect(result?.media).toBe("application/json")
      })

      t.it("returns text route when no JSON", () => {
        const routes = Route.html("html").text("text")
        const result = Router.matchMedia(routes, "")
        t.expect(result?.media).toBe("text/plain")
      })

      t.it("returns HTML route when no JSON or text", () => {
        const routes = Route.html("html")
        const result = Router.matchMedia(routes, "")
        t.expect(result?.media).toBe("text/html")
      })

      t.it("returns wildcard route when no known media", () => {
        const wildcardRoute = Route.make({
          method: "GET",
          media: "*",
          handler: () => Effect.succeed("raw"),
          schemas: {},
        })
        const result = Router.matchMedia(wildcardRoute, "")
        t.expect(result?.media).toBe("*")
      })
    },
  )

  t.describe("explicit accept header", () => {
    t.it("returns JSON when Accept: application/json", () => {
      const routes = Route.html("html").json({ data: "json" }).text("text")
      const result = Router.matchMedia(routes, "application/json")
      t.expect(result?.media).toBe("application/json")
    })

    t.it("returns text when Accept: text/plain", () => {
      const routes = Route.html("html").json({ data: "json" }).text("text")
      const result = Router.matchMedia(routes, "text/plain")
      t.expect(result?.media).toBe("text/plain")
    })

    t.it("returns HTML when Accept: text/html", () => {
      const routes = Route.json({ data: "json" }).html("html").text("text")
      const result = Router.matchMedia(routes, "text/html")
      t.expect(result?.media).toBe("text/html")
    })
  })

  t.describe("quality values", () => {
    t.it("respects quality values - prefers higher q", () => {
      const routes = Route.html("html").json({ data: "json" })
      const result = Router.matchMedia(
        routes,
        "text/html;q=0.9, application/json;q=1.0",
      )
      t.expect(result?.media).toBe("application/json")
    })

    t.it("prefers HTML when HTML has higher q", () => {
      const routes = Route.html("html").json({ data: "json" })
      const result = Router.matchMedia(
        routes,
        "text/html;q=1.0, application/json;q=0.5",
      )
      t.expect(result?.media).toBe("text/html")
    })

    t.it("default q=1.0 when not specified", () => {
      const routes = Route.html("html").json({ data: "json" })
      const result = Router.matchMedia(
        routes,
        "text/html;q=0.9, application/json",
      )
      t.expect(result?.media).toBe("application/json")
    })
  })

  t.describe("wildcards", () => {
    t.it("*/* uses priority order (json > text > html)", () => {
      const routes = Route.html("html").text("text").json({ data: "json" })
      const result = Router.matchMedia(routes, "*/*")
      t.expect(result?.media).toBe("application/json")
    })

    t.it("text/* matches text/plain first (by priority)", () => {
      const routes = Route.json({ data: "json" }).html("html").text("text")
      const result = Router.matchMedia(routes, "text/*")
      t.expect(result?.media).toBe("text/plain")
    })
  })

  t.describe("fallback behavior", () => {
    t.it("returns wildcard route when no specific match", () => {
      const routes = Route
        .make({
          method: "GET",
          media: "*",
          handler: () => Effect.succeed("raw"),
          schemas: {},
        })
        .json({ data: "json" })
      const result = Router.matchMedia(routes, "image/png")
      t.expect(result?.media).toBe("*")
    })

    t.it("returns first route when no match and no wildcard", () => {
      const routes = Route.json({ data: "json" }).text("text")
      const result = Router.matchMedia(routes, "image/png")
      t.expect(result?.media).toBe("application/json")
    })

    t.it("returns undefined for empty routes", () => {
      const routes = RouteSet.make()
      const result = Router.matchMedia(routes, "application/json")
      t.expect(result).toBeUndefined()
    })
  })

  t.describe("specificity", () => {
    t.it("prefers exact match over wildcard", () => {
      const routes = Route.html("html").json({ data: "json" })
      const result = Router.matchMedia(
        routes,
        "text/*, application/json",
      )
      t.expect(result?.media).toBe("application/json")
    })
  })
})

t.describe("RouteHttp.toWebHandler", () => {
  t.describe("basic route rendering", () => {
    t.it("renders text route", async () => {
      const routes = Route.text("Hello World")
      const routes2 = Route.text(function*() {
        return "Hello World"
      })

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      t.expect(response.status).toBe(200)
      t.expect(await response.text()).toBe("Hello World")
      t.expect(response.headers.get("content-type")).toContain("text/plain")
    })

    t.it("renders json route", async () => {
      const routes = Route.json({ message: "ok", count: 42 })

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      t.expect(response.status).toBe(200)
      t.expect(await response.json()).toEqual({ message: "ok", count: 42 })
      t.expect(response.headers.get("content-type")).toContain(
        "application/json",
      )
    })

    t.it("renders html route", async () => {
      const routes = Route.html("<h1>Title</h1>")

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      t.expect(response.status).toBe(200)
      t.expect(await response.text()).toBe("<h1>Title</h1>")
      t.expect(response.headers.get("content-type")).toContain("text/html")
    })
  })

  t.describe("content negotiation", () => {
    t.it("selects route based on Accept header", async () => {
      const routes = Route.text("text response").json({ type: "json" })

      const webHandler = RouteHttp.toWebHandler(routes)

      const jsonResponse = await webHandler(
        new Request("http://localhost/test", {
          headers: { Accept: "application/json" },
        }),
      )
      t.expect(await jsonResponse.json()).toEqual({ type: "json" })

      const textResponse = await webHandler(
        new Request("http://localhost/test", {
          headers: { Accept: "text/plain" },
        }),
      )
      t.expect(await textResponse.text()).toBe("text response")
    })

    t.it("returns 406 when routes are empty", async () => {
      const routes = RouteSet.make()
      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      t.expect(response.status).toBe(406)
    })

    t.it("falls back to first route when no Accept match", async () => {
      const routes = Route.json({ data: 1 })

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(
        new Request("http://localhost/test", {
          headers: { Accept: "image/png" },
        }),
      )

      t.expect(response.status).toBe(200)
      t.expect(await response.json()).toEqual({ data: 1 })
    })

    t.it("uses wildcard priority when Accept is */*", async () => {
      const routes = Route.html("<p>html</p>").json({ type: "json" })

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(
        new Request("http://localhost/test", {
          headers: { Accept: "*/*" },
        }),
      )

      t.expect(await response.json()).toEqual({ type: "json" })
    })
  })

  t.describe("toHttpApp with middleware", () => {
    t.it("allows middleware to be applied to httpApp", async () => {
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

      t.expect(response.headers.get("X-Custom")).toBe("value")
      t.expect(await response.text()).toBe("content")
    })
  })

  t.describe("error handling", () => {
    t.it("catches handler errors and returns error response", async () => {
      const routes = Route.json(Effect.fail(new Error("Something went wrong")))

      const webHandler = RouteHttp.toWebHandler(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      t.expect(response.status).toBe(500)
    })
  })

  t.describe("toWebHandlerRuntime", () => {
    t.it("uses provided runtime", async () => {
      const routes = Route.text("with runtime")

      const runtime = await runWithBunHttpServer(
        Effect.runtime<BunHttpServer.BunHttpServer>(),
      )

      const webHandler = RouteHttp.toWebHandlerRuntime(runtime)(routes)
      const response = await webHandler(new Request("http://localhost/test"))

      t.expect(await response.text()).toBe("with runtime")
    })
  })
})
