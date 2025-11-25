import type { HTMLBundle } from "bun"
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Route from "../Route.ts"
import type * as Router from "../Router.ts"
import * as BunRoute from "./BunRoute.ts"

t.describe("loadBundle", () => {
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

t.describe("isBunRoute", () => {
  t.test("returns true for BunRoute", () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.loadBundle(() => Promise.resolve(mockBundle))

    t.expect(BunRoute.isBunRoute(bunRoute)).toBe(true)
  })

  t.test("returns false for regular Route", () => {
    const route = Route.text(Effect.succeed("hello"))

    t.expect(BunRoute.isBunRoute(route)).toBe(false)
  })

  t.test("returns false for non-route values", () => {
    t.expect(BunRoute.isBunRoute(null)).toBe(false)
    t.expect(BunRoute.isBunRoute(undefined)).toBe(false)
    t.expect(BunRoute.isBunRoute({})).toBe(false)
    t.expect(BunRoute.isBunRoute("string")).toBe(false)
  })
})

t.describe("routesFromRouter", () => {
  t.test("converts text route to fetch handler", async () => {
    const fetch = await makeFetch(
      makeRouter([
        { path: "/hello", routes: Route.text(Effect.succeed("Hello World")) },
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
          routes: Route.json(Effect.succeed({ message: "ok", count: 42 })),
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
          routes: Route.get(Route.json(Effect.succeed({ users: [] }))).post(
            Route.json(Effect.succeed({ created: true })),
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
          { path: "/users/[id]", routes: Route.text(Effect.succeed("user")) },
          {
            path: "/docs/[...path]",
            routes: Route.text(Effect.succeed("docs")),
          },
        ]),
      ),
    )

    t.expect(routes["/users/:id"]).toBeDefined()
    t.expect(routes["/docs/*"]).toBeDefined()
    t.expect(routes["/users/[id]"]).toBeUndefined()
    t.expect(routes["/docs/[...path]"]).toBeUndefined()
  })

  t.test("includes BunRoute bundles in result", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.loadBundle(() => Promise.resolve(mockBundle))

    const routes = await Effect.runPromise(
      BunRoute.routesFromRouter(
        makeRouter([{ path: "/app", routes: bunRoute }]),
      ),
    )

    t.expect(routes["/app"]).toBe(mockBundle)
  })

  t.test("handles mixed BunRoute and regular routes", async () => {
    const mockBundle = { index: "index.html" } as HTMLBundle
    const bunRoute = BunRoute.loadBundle(() => Promise.resolve(mockBundle))

    const routes = await Effect.runPromise(
      BunRoute.routesFromRouter({
        modules: [
          {
            path: "/app",
            segments: [],
            load: () => Promise.resolve({ default: bunRoute }),
          },
          {
            path: "/api/health",
            segments: [],
            load: () =>
              Promise.resolve({
                default: Route.json(Effect.succeed({ ok: true })),
              }),
          },
        ],
        httpRouter: {} as Router.RouterContext["httpRouter"],
      }),
    )

    t.expect(routes["/app"]).toBe(mockBundle)
    t.expect(routes["/api/health"]).toBeDefined()
    t.expect(typeof routes["/api/health"]).toBe("object")
  })

  t.test("groups multiple methods under same path", async () => {
    const fetch = await makeFetch(
      makeRouter([
        {
          path: "/resource",
          routes: Route
            .get(Route.text(Effect.succeed("get")))
            .post(Route.text(Effect.succeed("post")))
            .del(Route.text(Effect.succeed("delete"))),
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
        routes: Route.text(Effect.succeed("test")),
      }]),
    )

    const response = await fetch("/test")

    t.expect(response).toBeInstanceOf(Response)
  })

  t.test("text response has correct content-type", async () => {
    const fetch = await makeFetch(
      makeRouter([{
        path: "/text",
        routes: Route.text(Effect.succeed("hello")),
      }]),
    )

    const response = await fetch("/text")

    t.expect(response.headers.get("content-type")).toContain("text/plain")
  })

  t.test("json response has correct content-type", async () => {
    const fetch = await makeFetch(
      makeRouter([{
        path: "/json",
        routes: Route.json(Effect.succeed({ data: 1 })),
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
        routes: Route.text(Effect.succeed("readable body")),
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
      makeRouter([{ path: "/ok", routes: Route.text(Effect.succeed("ok")) }]),
    )

    const response = await fetch("/ok")

    t.expect(response.ok).toBe(true)
    t.expect(response.status).toBe(200)
  })
})

const makeRouter = (
  modules: Array<{
    path: `/${string}`
    routes: Route.RouteSet.Default
  }>,
): Router.RouterContext => ({
  modules: modules.map((m) => ({
    path: m.path,
    segments: [],
    load: () => Promise.resolve({ default: m.routes }),
  })),
  httpRouter: {} as Router.RouterContext["httpRouter"],
})

type FetchFn = (path: string, init?: { method?: string }) => Promise<Response>

type HandlerFn = (req: Request) => Response | Promise<Response>

async function makeFetch(router: Router.RouterContext): Promise<FetchFn> {
  const routes = await Effect.runPromise(BunRoute.routesFromRouter(router))

  return async (path, init) => {
    const method = init?.method ?? "GET"
    const handler = routes[path]

    if (!handler) {
      throw new Error(`No handler for path: ${path}`)
    }

    if (typeof handler === "function") {
      return handler(new Request(`http://localhost${path}`, init))
    }

    const methodHandler = (handler as Record<string, HandlerFn>)[method]
    if (!methodHandler) {
      throw new Error(`No handler for ${method} ${path}`)
    }

    return methodHandler(new Request(`http://localhost${path}`, init))
  }
}
