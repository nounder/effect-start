import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Route from "./Route.ts"
import * as RouteRender from "./RouteRender.ts"

function makeRoute(media: Route.RouteMedia): Route.Route.Default {
  return Route.make({
    method: "GET",
    media,
    handler: () => Effect.succeed(`response-${media}`),
    schemas: {},
  })
}

t.describe("RouteRender.selectRouteByMedia", () => {
  const htmlRoute = makeRoute("text/html")
  const jsonRoute = makeRoute("application/json")
  const textRoute = makeRoute("text/plain")
  const wildcardRoute = makeRoute("*")

  t.describe(
    "empty accept header (wildcard priority: json > text > html)",
    () => {
      t.it("returns JSON route when available", () => {
        const routes = [htmlRoute, textRoute, jsonRoute]
        const result = RouteRender.selectRouteByMedia(routes, "")
        t.expect(result?.media).toBe("application/json")
      })

      t.it("returns text route when no JSON", () => {
        const routes = [htmlRoute, textRoute]
        const result = RouteRender.selectRouteByMedia(routes, "")
        t.expect(result?.media).toBe("text/plain")
      })

      t.it("returns HTML route when no JSON or text", () => {
        const routes = [htmlRoute, wildcardRoute]
        const result = RouteRender.selectRouteByMedia(routes, "")
        t.expect(result?.media).toBe("text/html")
      })

      t.it("returns wildcard route when no known media", () => {
        const routes = [wildcardRoute]
        const result = RouteRender.selectRouteByMedia(routes, "")
        t.expect(result?.media).toBe("*")
      })
    },
  )

  t.describe("explicit accept header", () => {
    t.it("returns JSON when Accept: application/json", () => {
      const routes = [htmlRoute, jsonRoute, textRoute]
      const result = RouteRender.selectRouteByMedia(routes, "application/json")
      t.expect(result?.media).toBe("application/json")
    })

    t.it("returns text when Accept: text/plain", () => {
      const routes = [htmlRoute, jsonRoute, textRoute]
      const result = RouteRender.selectRouteByMedia(routes, "text/plain")
      t.expect(result?.media).toBe("text/plain")
    })

    t.it("returns HTML when Accept: text/html", () => {
      const routes = [jsonRoute, htmlRoute, textRoute]
      const result = RouteRender.selectRouteByMedia(routes, "text/html")
      t.expect(result?.media).toBe("text/html")
    })
  })

  t.describe("quality values", () => {
    t.it("respects quality values - prefers higher q", () => {
      const routes = [htmlRoute, jsonRoute]
      const result = RouteRender.selectRouteByMedia(
        routes,
        "text/html;q=0.9, application/json;q=1.0",
      )
      t.expect(result?.media).toBe("application/json")
    })

    t.it("prefers HTML when HTML has higher q", () => {
      const routes = [htmlRoute, jsonRoute]
      const result = RouteRender.selectRouteByMedia(
        routes,
        "text/html;q=1.0, application/json;q=0.5",
      )
      t.expect(result?.media).toBe("text/html")
    })

    t.it("default q=1.0 when not specified", () => {
      const routes = [htmlRoute, jsonRoute]
      const result = RouteRender.selectRouteByMedia(
        routes,
        "text/html;q=0.9, application/json",
      )
      t.expect(result?.media).toBe("application/json")
    })
  })

  t.describe("wildcards", () => {
    t.it("*/* uses priority order (json > text > html)", () => {
      const routes = [htmlRoute, textRoute, jsonRoute]
      const result = RouteRender.selectRouteByMedia(routes, "*/*")
      t.expect(result?.media).toBe("application/json")
    })

    t.it("text/* matches text/plain first (by priority)", () => {
      const routes = [jsonRoute, htmlRoute, textRoute]
      const result = RouteRender.selectRouteByMedia(routes, "text/*")
      t.expect(result?.media).toBe("text/plain")
    })
  })

  t.describe("fallback behavior", () => {
    t.it("returns wildcard route when no specific match", () => {
      const routes = [wildcardRoute, jsonRoute]
      const result = RouteRender.selectRouteByMedia(routes, "image/png")
      t.expect(result?.media).toBe("*")
    })

    t.it("returns first route when no match and no wildcard", () => {
      const routes = [jsonRoute, textRoute]
      const result = RouteRender.selectRouteByMedia(routes, "image/png")
      t.expect(result?.media).toBe("application/json")
    })

    t.it("returns undefined for empty routes array", () => {
      const result = RouteRender.selectRouteByMedia([], "application/json")
      t.expect(result).toBeUndefined()
    })
  })

  t.describe("specificity", () => {
    t.it("prefers exact match over wildcard", () => {
      const routes = [htmlRoute, jsonRoute]
      const result = RouteRender.selectRouteByMedia(
        routes,
        "text/*, application/json",
      )
      t.expect(result?.media).toBe("application/json")
    })
  })
})
