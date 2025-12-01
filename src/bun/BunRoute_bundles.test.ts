import * as Bun from "bun"
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Route from "../Route.ts"
import type * as Router from "../Router.ts"
import * as BunRoute from "./BunRoute.ts"

t.describe("BunRoute proxy with Bun.serve", () => {
  t.test("BunRoute proxy returns same content as direct bundle access", async () => {
    const bunRoute = BunRoute.loadBundle(() =>
      import("../../static/TestPage.html")
    )

    const router: Router.RouterContext = {
      routes: [
        {
          path: "/test",
          load: () => Promise.resolve({ default: bunRoute }),
        },
      ],
    }

    const routes = await Effect.runPromise(BunRoute.routesFromRouter(router))

    const internalPath = Object.keys(routes).find((k) =>
      k.includes("~BunRoute-")
    )
    t.expect(internalPath).toBeDefined()

    const proxyHandler = routes["/test"]
    t.expect(typeof proxyHandler).toBe("function")

    const internalBundle = routes[internalPath!]
    t.expect(internalBundle).toHaveProperty("index")

    const server = Bun.serve({
      port: 0,
      routes,
      fetch: () => new Response("Not found", { status: 404 }),
    })

    try {
      const directResponse = await fetch(
        `http://localhost:${server.port}${internalPath}`,
      )
      const proxyResponse = await fetch(`http://localhost:${server.port}/test`)

      t.expect(proxyResponse.status).toBe(directResponse.status)

      const directText = await directResponse.text()
      const proxyText = await proxyResponse.text()

      t.expect(proxyText).toBe(directText)
      t.expect(proxyText).toContain("Test Page Content")
    } finally {
      server.stop()
    }
  })

  t.test("multiple BunRoutes each get unique internal paths", async () => {
    const bunRoute1 = BunRoute.loadBundle(() =>
      import("../../static/TestPage.html")
    )
    const bunRoute2 = BunRoute.loadBundle(() =>
      import("../../static/AnotherPage.html")
    )

    const router: Router.RouterContext = {
      routes: [
        {
          path: "/page1",
          load: () => Promise.resolve({ default: bunRoute1 }),
        },
        {
          path: "/page2",
          load: () => Promise.resolve({ default: bunRoute2 }),
        },
      ],
    }

    const routes = await Effect.runPromise(BunRoute.routesFromRouter(router))

    const internalPaths = Object.keys(routes).filter((k) =>
      k.includes("~BunRoute-")
    )
    t.expect(internalPaths).toHaveLength(2)

    const nonces = internalPaths.map((p) => {
      const match = p.match(/~BunRoute-([a-z0-9]+)$/)
      return match?.[1]
    })
    t.expect(nonces[0]).toBe(nonces[1])

    const server = Bun.serve({
      port: 0,
      routes,
      fetch: () => new Response("Not found", { status: 404 }),
    })

    try {
      const response1 = await fetch(`http://localhost:${server.port}/page1`)
      const response2 = await fetch(`http://localhost:${server.port}/page2`)

      const text1 = await response1.text()
      const text2 = await response2.text()

      t.expect(text1).toContain("Test Page Content")
      t.expect(text2).toContain("Another Page Content")
    } finally {
      server.stop()
    }
  })

  t.test("proxy preserves request headers", async () => {
    const bunRoute = BunRoute.loadBundle(() =>
      import("../../static/TestPage.html")
    )

    const router: Router.RouterContext = {
      routes: [
        {
          path: "/headers-test",
          load: () => Promise.resolve({ default: bunRoute }),
        },
      ],
    }

    const routes = await Effect.runPromise(BunRoute.routesFromRouter(router))

    const server = Bun.serve({
      port: 0,
      routes,
      fetch: () => new Response("Not found", { status: 404 }),
    })

    try {
      const response = await fetch(
        `http://localhost:${server.port}/headers-test`,
        {
          headers: {
            "Accept": "text/html",
            "X-Custom-Header": "test-value",
          },
        },
      )

      t.expect(response.status).toBe(200)
      t.expect(await response.text()).toContain("Test Page Content")
    } finally {
      server.stop()
    }
  })

  t.test("mixed BunRoute and regular routes work together", async () => {
    const bunRoute = BunRoute.loadBundle(() =>
      import("../../static/TestPage.html")
    )
    const textRoute = Route.text("Hello from text route")

    const router: Router.RouterContext = {
      routes: [
        {
          path: "/html",
          load: () => Promise.resolve({ default: bunRoute }),
        },
        {
          path: "/api",
          load: () => Promise.resolve({ default: textRoute }),
        },
      ],
    }

    const routes = await Effect.runPromise(BunRoute.routesFromRouter(router))

    const server = Bun.serve({
      port: 0,
      routes,
      fetch: () => new Response("Not found", { status: 404 }),
    })

    try {
      const htmlResponse = await fetch(`http://localhost:${server.port}/html`)
      const apiResponse = await fetch(`http://localhost:${server.port}/api`)

      t.expect(await htmlResponse.text()).toContain("Test Page Content")
      t.expect(await apiResponse.text()).toBe("Hello from text route")
    } finally {
      server.stop()
    }
  })

  t.test("nonce is different across separate routesFromRouter calls", async () => {
    const bunRoute = BunRoute.loadBundle(() =>
      import("../../static/TestPage.html")
    )

    const router: Router.RouterContext = {
      routes: [
        {
          path: "/test",
          load: () => Promise.resolve({ default: bunRoute }),
        },
      ],
    }

    const routes1 = await Effect.runPromise(BunRoute.routesFromRouter(router))
    const routes2 = await Effect.runPromise(BunRoute.routesFromRouter(router))

    const internalPath1 = Object.keys(routes1).find((k) =>
      k.includes("~BunRoute-")
    )
    const internalPath2 = Object.keys(routes2).find((k) =>
      k.includes("~BunRoute-")
    )

    t.expect(internalPath1).not.toBe(internalPath2)
  })
})
