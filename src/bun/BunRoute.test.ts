import type { HTMLBundle } from "bun"
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Route from "../Route.ts"
import type * as Router from "../Router.ts"
import * as BunRoute from "./BunRoute.ts"

t.describe(`${BunRoute.loadBundle.name}`, () => {
  t.test("creates BunRoute from HTMLBundle", () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.loadBundle(() => Promise.resolve(mockBundle))

    t.expect(BunRoute.isBunRoute(bunRoute)).toBe(true)
    t.expect(Route.isRouteSet(bunRoute)).toBe(true)
    t.expect(bunRoute.set).toHaveLength(1)
    t.expect(bunRoute.method as string).toBe("GET")
    t.expect(bunRoute.media as string).toBe("text/html")
  })

  t.test("unwraps default export", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.loadBundle(() =>
      Promise.resolve({ default: mockBundle })
    )

    const loaded = await bunRoute.load()
    t.expect(loaded).toBe(mockBundle)
  })

  t.test("returns bundle directly when no default", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.loadBundle(() => Promise.resolve(mockBundle))

    const loaded = await bunRoute.load()
    t.expect(loaded).toBe(mockBundle)
  })
})

t.describe(`${BunRoute.isBunRoute.name}`, () => {
  t.test("returns true for BunRoute", () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.loadBundle(() => Promise.resolve(mockBundle))

    t.expect(BunRoute.isBunRoute(bunRoute)).toBe(true)
  })

  t.test("returns false for regular Route", () => {
    const route = Route.text("hello")

    t.expect(BunRoute.isBunRoute(route)).toBe(false)
  })

  t.test("returns false for non-route values", () => {
    t.expect(BunRoute.isBunRoute(null)).toBe(false)
    t.expect(BunRoute.isBunRoute(undefined)).toBe(false)
    t.expect(BunRoute.isBunRoute({})).toBe(false)
    t.expect(BunRoute.isBunRoute("string")).toBe(false)
  })
})

t.describe(`${BunRoute.routesFromRouter.name}`, () => {
  t.test("converts text route to fetch handler", async () => {
    const fetch = await makeFetch(
      makeRouter([
        { path: "/hello", routes: Route.text("Hello World") },
      ]),
    )

    const response = await fetch("/hello")

    t.expect(response.status).toBe(200)
    t.expect(await response.text()).toBe("Hello World")
  })

  t.test("converts json route to fetch handler", async () => {
    const fetch = await makeFetch(
      makeRouter([
        {
          path: "/api/data",
          routes: Route.json({ message: "ok", count: 42 }),
        },
      ]),
    )

    const response = await fetch("/api/data")

    t.expect(response.status).toBe(200)
    t.expect(await response.json()).toEqual({ message: "ok", count: 42 })
  })

  t.test("converts html route to fetch handler", async () => {
    const fetch = await makeFetch(
      makeRouter([
        { path: "/page", routes: Route.html(Effect.succeed("<h1>Title</h1>")) },
      ]),
    )

    const response = await fetch("/page")

    t.expect(response.status).toBe(200)
    t.expect(await response.text()).toBe("<h1>Title</h1>")
  })

  t.test("handles method-specific routes", async () => {
    const fetch = await makeFetch(
      makeRouter([
        {
          path: "/users",
          routes: Route.get(Route.json({ users: [] })).post(
            Route.json({ created: true }),
          ),
        },
      ]),
    )

    const getResponse = await fetch("/users")
    t.expect(await getResponse.json()).toEqual({ users: [] })

    const postResponse = await fetch("/users", { method: "POST" })
    t.expect(await postResponse.json()).toEqual({ created: true })
  })

  t.test("converts path syntax to Bun format", async () => {
    const routes = await Effect.runPromise(
      BunRoute.routesFromRouter(
        makeRouter([
          { path: "/users/[id]", routes: Route.text("user") },
          {
            path: "/docs/[...path]",
            routes: Route.text("docs"),
          },
        ]),
      ),
    )

    t.expect(routes["/users/:id"]).toBeDefined()
    t.expect(routes["/docs/*"]).toBeDefined()
    t.expect(routes["/users/[id]"]).toBeUndefined()
    t.expect(routes["/docs/[...path]"]).toBeUndefined()
  })

  t.test("creates proxy and internal routes for BunRoute", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.loadBundle(() => Promise.resolve(mockBundle))

    const routes = await Effect.runPromise(
      BunRoute.routesFromRouter(
        makeRouter([{ path: "/app", routes: bunRoute }]),
      ),
    )

    const internalPath = Object.keys(routes).find((k) =>
      k.includes("~BunRoute-")
    )
    t.expect(internalPath).toBeDefined()
    t.expect(routes[internalPath!]).toBe(mockBundle)
    t.expect(typeof routes["/app"]).toBe("function")
  })

  t.test("handles mixed BunRoute and regular routes", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.loadBundle(() => Promise.resolve(mockBundle))

    const routes = await Effect.runPromise(
      BunRoute.routesFromRouter({
        routes: [
          {
            path: "/app",
            load: () => Promise.resolve({ default: bunRoute }),
          },
          {
            path: "/api/health",
            load: () =>
              Promise.resolve({
                default: Route.json({ ok: true }),
              }),
          },
        ],
      }),
    )

    const internalPath = Object.keys(routes).find((k) =>
      k.includes("~BunRoute-")
    )
    t.expect(internalPath).toBeDefined()
    t.expect(routes[internalPath!]).toBe(mockBundle)
    t.expect(typeof routes["/app"]).toBe("function")
    t.expect(routes["/api/health"]).toBeDefined()
    t.expect(typeof routes["/api/health"]).toBe("object")
  })

  t.test("groups multiple methods under same path", async () => {
    const fetch = await makeFetch(
      makeRouter([
        {
          path: "/resource",
          routes: Route
            .get(Route.text("get"))
            .post(Route.text("post"))
            .del(Route.text("delete")),
        },
      ]),
    )

    const getRes = await fetch("/resource")
    const postRes = await fetch("/resource", { method: "POST" })
    const delRes = await fetch("/resource", { method: "DELETE" })

    t.expect(await getRes.text()).toBe("get")
    t.expect(await postRes.text()).toBe("post")
    t.expect(await delRes.text()).toBe("delete")
  })
})

t.describe("fetch handler Response", () => {
  t.test("returns Response instance", async () => {
    const fetch = await makeFetch(
      makeRouter([{
        path: "/test",
        routes: Route.text("test"),
      }]),
    )

    const response = await fetch("/test")

    t.expect(response).toBeInstanceOf(Response)
  })

  t.test("text response has correct content-type", async () => {
    const fetch = await makeFetch(
      makeRouter([{
        path: "/text",
        routes: Route.text("hello"),
      }]),
    )

    const response = await fetch("/text")

    t.expect(response.headers.get("content-type")).toContain("text/plain")
  })

  t.test("json response has correct content-type", async () => {
    const fetch = await makeFetch(
      makeRouter([{
        path: "/json",
        routes: Route.json({ data: 1 }),
      }]),
    )

    const response = await fetch("/json")

    t.expect(response.headers.get("content-type")).toContain("application/json")
  })

  t.test("html response has correct content-type", async () => {
    const fetch = await makeFetch(
      makeRouter([{
        path: "/html",
        routes: Route.html(Effect.succeed("<p>hi</p>")),
      }]),
    )

    const response = await fetch("/html")

    t.expect(response.headers.get("content-type")).toContain("text/html")
  })

  t.test("response body is readable", async () => {
    const fetch = await makeFetch(
      makeRouter([{
        path: "/body",
        routes: Route.text("readable body"),
      }]),
    )

    const response = await fetch("/body")

    t.expect(response.bodyUsed).toBe(false)
    const text = await response.text()
    t.expect(text).toBe("readable body")
    t.expect(response.bodyUsed).toBe(true)
  })

  t.test("response ok is true for 200 status", async () => {
    const fetch = await makeFetch(
      makeRouter([{ path: "/ok", routes: Route.text("ok") }]),
    )

    const response = await fetch("/ok")

    t.expect(response.ok).toBe(true)
    t.expect(response.status).toBe(200)
  })
})

const makeRouter = (
  routesList: Array<{
    path: `/${string}`
    routes: Route.RouteSet.Default
  }>,
): Router.RouterContext => ({
  routes: routesList.map((m) => ({
    path: m.path,
    load: () => Promise.resolve({ default: m.routes }),
  })),
})

type FetchFn = (path: string, init?: { method?: string }) => Promise<Response>

type HandlerFn = (
  req: Request,
  server: unknown,
) => Response | Promise<Response>

async function makeFetch(router: Router.RouterContext): Promise<FetchFn> {
  const routes = await Effect.runPromise(BunRoute.routesFromRouter(router))
  const mockServer = {} as import("bun").Server<unknown>

  return async (path, init) => {
    const method = init?.method ?? "GET"
    const handler = routes[path]

    if (!handler) {
      throw new Error(`No handler for path: ${path}`)
    }

    if (typeof handler === "function") {
      return handler(new Request(`http://localhost${path}`, init), mockServer)
    }

    const methodHandler = (handler as Record<string, HandlerFn>)[method]
    if (!methodHandler) {
      throw new Error(`No handler for ${method} ${path}`)
    }

    return methodHandler(
      new Request(`http://localhost${path}`, init),
      mockServer,
    )
  }
}
