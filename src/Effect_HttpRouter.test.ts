/**
 * This file tests `@effect/platform/HttpRouter`, not our code.
 * Since Platform code is still unstable and we relay heavily on its
 * chaining/fallback behavior in `BundleHttp` & `FileHttpRouter`.
 * We want to ensure the behavior doesn't change across versions.
 */
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as TestHttpClient from "../src/TestHttpClient.ts"
import { effectFn } from "../src/testing.ts"

const effect = effectFn()

t.it("Single app mounted on path", () =>
  effect(function*() {
    const app1 = HttpRouter.empty.pipe(
      HttpRouter.get("/hello", HttpServerResponse.text("Hello from app1")),
    )

    const router = HttpRouter.empty.pipe(
      HttpRouter.mount("/api", app1),
    )

    const client = TestHttpClient.make(router)
    const response = yield* client.get("/api/hello")

    t
      .expect(response.status)
      .toBe(200)

    t
      .expect(yield* response.text)
      .toBe("Hello from app1")
  }))

t.it(
  "Multiple apps mounted on same path chain together",
  () =>
    effect(function*() {
      const app1 = HttpRouter.empty.pipe(
        HttpRouter.get("/hello", HttpServerResponse.text("Hello from app1")),
      )

      const app2 = HttpRouter.empty.pipe(
        HttpRouter.get("/world", HttpServerResponse.text("World from app2")),
      )

      const router = HttpRouter.empty.pipe(
        HttpRouter.mount("/api", app1),
        HttpRouter.mount("/api", app2),
      )

      const client = TestHttpClient.make(router)

      const response1 = yield* client.get("/api/hello")

      t
        .expect(response1.status)
        .toBe(200)

      t
        .expect(yield* response1.text)
        .toBe("Hello from app1")

      const response2 = yield* client.get("/api/world")

      t
        .expect(response2.status)
        .toBe(200)

      t
        .expect(yield* response2.text)
        .toBe("World from app2")
    }),
)

t.it(
  "First app has no matching route - second app should be called",
  () =>
    effect(function*() {
      const app1 = HttpRouter.empty.pipe(
        HttpRouter.get("/hello", HttpServerResponse.text("Hello from app1")),
      )

      const app2 = HttpRouter.empty.pipe(
        HttpRouter.get("/missing", HttpServerResponse.text("Found in app2")),
      )

      const router = HttpRouter.empty.pipe(
        HttpRouter.mount("/api", app1),
        HttpRouter.mount("/api", app2),
      )

      const client = TestHttpClient.make(router)
      const response = yield* client.get("/api/missing")

      t
        .expect(response.status)
        .toBe(200)

      t
        .expect(yield* response.text)
        .toBe("Found in app2")
    }),
)

t.it(
  "First app has no matching route - second app should be called",
  () =>
    effect(function*() {
      const app1 = HttpRouter.empty.pipe(
        HttpRouter.get("/specific", HttpServerResponse.text("Specific route")),
      )

      const app2 = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/different",
          HttpServerResponse.text("Different route"),
        ),
      )

      const router = HttpRouter.empty.pipe(
        HttpRouter.mount("/api", app1),
        HttpRouter.mount("/api", app2),
      )

      const client = TestHttpClient.make(router)
      const response = yield* client.get("/api/different")

      t
        .expect(response.status)
        .toBe(200)

      t
        .expect(yield* response.text)
        .toBe("Different route")
    }),
)

t.it("Multiple mounts with different methods", () =>
  effect(function*() {
    const app1 = HttpRouter.empty.pipe(
      HttpRouter.get("/data", HttpServerResponse.text("GET data")),
    )

    const app2 = HttpRouter.empty.pipe(
      HttpRouter.post("/data", HttpServerResponse.text("POST data")),
    )

    const router = HttpRouter.empty.pipe(
      HttpRouter.mount("/api", app1),
      HttpRouter.mount("/api", app2),
    )

    const client = TestHttpClient.make(router)

    const getResponse = yield* client.get("/api/data")

    t
      .expect(getResponse.status)
      .toBe(200)

    t
      .expect(yield* getResponse.text)
      .toBe("GET data")

    const postResponse = yield* client.post("/api/data")

    t
      .expect(postResponse.status)
      .toBe(200)

    t
      .expect(yield* postResponse.text)
      .toBe("POST data")
  }))

t.it(
  "Route chaining: RouteNotFound error chains to next router (root mount)",
  () =>
    effect(function*() {
      const subApp1 = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/admin/dashboard",
          HttpServerResponse.text("Dashboard from subApp1"),
        ),
      )

      const subApp2 = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/admin/page",
          HttpServerResponse.text("Page from subApp2"),
        ),
      )

      const router = HttpRouter.empty.pipe(
        HttpRouter.mount("/", subApp1),
        HttpRouter.mount("/", subApp2),
      )

      const client = TestHttpClient.make(router)
      const response = yield* client.get("/admin/page")

      t
        .expect(response.status)
        .toBe(200)

      t
        .expect(yield* response.text)
        .toBe("Page from subApp2")
    }),
)

t.it(
  "Route chaining: explicit 404 response does not chain to next router (root mount)",
  () =>
    effect(function*() {
      const subApp1 = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/admin/page",
          HttpServerResponse.empty({ status: 404 }),
        ),
      )

      const subApp2 = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/admin/fallback",
          HttpServerResponse.text("Fallback from subApp2"),
        ),
      )

      const router = HttpRouter.empty.pipe(
        HttpRouter.mount("/", subApp1),
        HttpRouter.mount("/", subApp2),
      )

      const client = TestHttpClient.make(router)
      const response = yield* client.get("/admin/page")

      t
        .expect(response.status)
        .toBe(404)

      t
        .expect(yield* response.text)
        .toBe("")
    }),
)

t.it(
  "Route conflicts: direct handlers win when defined before root mount",
  () =>
    effect(function*() {
      const subApp = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/admin/dashboard",
          HttpServerResponse.text("Dashboard from subApp"),
        ),
        HttpRouter.get(
          "/admin/profile",
          HttpServerResponse.text("Profile from subApp"),
        ),
      )

      const router = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/admin/settings",
          HttpServerResponse.text("Settings from direct handler"),
        ),
        HttpRouter.get(
          "/admin/users",
          HttpServerResponse.text("Users from direct handler"),
        ),
        HttpRouter.mount("/", subApp),
      )

      const client = TestHttpClient.make(router)

      const settingsResponse = yield* client.get("/admin/settings")

      t
        .expect(settingsResponse.status)
        .toBe(200)

      t
        .expect(yield* settingsResponse.text)
        .toBe("Settings from direct handler")

      const usersResponse = yield* client.get("/admin/users")

      t
        .expect(usersResponse.status)
        .toBe(200)

      t
        .expect(yield* usersResponse.text)
        .toBe("Users from direct handler")

      const dashboardResponse = yield* client.get("/admin/dashboard")

      t
        .expect(dashboardResponse.status)
        .toBe(200)

      t
        .expect(yield* dashboardResponse.text)
        .toBe("Dashboard from subApp")
    }),
)

t.it(
  "Route conflicts: root mount wins when defined before direct handlers",
  () =>
    effect(function*() {
      const subApp = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/admin/dashboard",
          HttpServerResponse.text("Dashboard from subApp"),
        ),
        HttpRouter.get(
          "/admin/profile",
          HttpServerResponse.text("Profile from subApp"),
        ),
      )

      const router = HttpRouter.empty.pipe(
        HttpRouter.mount("/", subApp),
        HttpRouter.get(
          "/admin/settings",
          HttpServerResponse.text("Settings from direct handler"),
        ),
        HttpRouter.get(
          "/admin/users",
          HttpServerResponse.text("Users from direct handler"),
        ),
      )

      const client = TestHttpClient.make(router)

      const profileResponse = yield* client.get("/admin/profile")

      t
        .expect(profileResponse.status)
        .toBe(200)

      t
        .expect(yield* profileResponse.text)
        .toBe("Profile from subApp")

      const usersResponse = yield* client.get("/admin/users")

      t
        .expect(usersResponse.status)
        .toBe(200)

      t
        .expect(yield* usersResponse.text)
        .toBe("Users from direct handler")

      const dashboardResponse = yield* client.get("/admin/dashboard")

      t
        .expect(dashboardResponse.status)
        .toBe(200)

      t
        .expect(yield* dashboardResponse.text)
        .toBe("Dashboard from subApp")
    }),
)

t.it(
  "Route conflicts: mountApp does not chain with direct handlers defined before",
  () =>
    effect(function*() {
      const subApp = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/admin/dashboard",
          HttpServerResponse.text("Dashboard from subApp"),
        ),
        HttpRouter.get(
          "/admin/profile",
          HttpServerResponse.text("Profile from subApp"),
        ),
      )

      const router = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/admin/settings",
          HttpServerResponse.text("Settings from direct handler"),
        ),
        HttpRouter.get(
          "/admin/users",
          HttpServerResponse.text("Users from direct handler"),
        ),
        HttpRouter.mountApp("/", subApp),
      )

      const client = TestHttpClient.make(router)

      const settingsResponse = yield* client.get("/admin/settings")

      t
        .expect(settingsResponse.status)
        .toBe(404)

      const usersResponse = yield* client.get("/admin/users")

      t
        .expect(usersResponse.status)
        .toBe(404)

      const dashboardResponse = yield* client.get("/admin/dashboard")

      t
        .expect(dashboardResponse.status)
        .toBe(200)

      t
        .expect(yield* dashboardResponse.text)
        .toBe("Dashboard from subApp")
    }),
)

t.it(
  "Route conflicts: mountApp does not chain with direct handlers defined after",
  () =>
    effect(function*() {
      const subApp = HttpRouter.empty.pipe(
        HttpRouter.get(
          "/admin/dashboard",
          HttpServerResponse.text("Dashboard from subApp"),
        ),
        HttpRouter.get(
          "/admin/profile",
          HttpServerResponse.text("Profile from subApp"),
        ),
      )

      const router = HttpRouter.empty.pipe(
        HttpRouter.mountApp("/", subApp),
        HttpRouter.get(
          "/admin/settings",
          HttpServerResponse.text("Settings from direct handler"),
        ),
        HttpRouter.get(
          "/admin/users",
          HttpServerResponse.text("Users from direct handler"),
        ),
      )

      const client = TestHttpClient.make(router)

      const profileResponse = yield* client.get("/admin/profile")

      t
        .expect(profileResponse.status)
        .toBe(200)

      t
        .expect(yield* profileResponse.text)
        .toBe("Profile from subApp")

      const settingsResponse = yield* client.get("/admin/settings")

      t
        .expect(settingsResponse.status)
        .toBe(404)

      const dashboardResponse = yield* client.get("/admin/dashboard")

      t
        .expect(dashboardResponse.status)
        .toBe(200)

      t
        .expect(yield* dashboardResponse.text)
        .toBe("Dashboard from subApp")
    }),
)

t.it(
  "Wildcard routes: single asterisk wildcard handler",
  () =>
    effect(function*() {
      const router = HttpRouter.empty.pipe(
        HttpRouter.get("*", HttpServerResponse.text("Wildcard handler")),
      )

      const client = TestHttpClient.make(router)

      const response = yield* client.get("/anything")

      t
        .expect(response.status)
        .toBe(200)

      t
        .expect(yield* response.text)
        .toBe("Wildcard handler")
    }),
)

t.it(
  "Wildcard routes: wildcard defined before literal route",
  () =>
    effect(function*() {
      const router = HttpRouter.empty.pipe(
        HttpRouter.get("*", HttpServerResponse.text("Wildcard handler")),
        HttpRouter.get("/specific", HttpServerResponse.text("Literal handler")),
      )

      const client = TestHttpClient.make(router)

      const wildcardResponse = yield* client.get("/anything")

      t
        .expect(wildcardResponse.status)
        .toBe(200)

      t
        .expect(yield* wildcardResponse.text)
        .toBe("Wildcard handler")

      const literalResponse = yield* client.get("/specific")

      t
        .expect(literalResponse.status)
        .toBe(200)

      t
        .expect(yield* literalResponse.text)
        .toBe("Literal handler")
    }),
)

t.it(
  "Wildcard routes: literal route defined before wildcard",
  () =>
    effect(function*() {
      const router = HttpRouter.empty.pipe(
        HttpRouter.get("/specific", HttpServerResponse.text("Literal handler")),
        HttpRouter.get("*", HttpServerResponse.text("Wildcard handler")),
      )

      const client = TestHttpClient.make(router)

      const literalResponse = yield* client.get("/specific")

      t
        .expect(literalResponse.status)
        .toBe(200)

      t
        .expect(yield* literalResponse.text)
        .toBe("Literal handler")

      const wildcardResponse = yield* client.get("/anything")

      t
        .expect(wildcardResponse.status)
        .toBe(200)

      t
        .expect(yield* wildcardResponse.text)
        .toBe("Wildcard handler")
    }),
)
