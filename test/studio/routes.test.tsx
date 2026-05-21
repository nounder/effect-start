import * as test from "bun:test"
import * as Fetch from "effect-start/Fetch"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Bundle from "../../src/bundler/Bundle.ts"
import routes from "../../src/studio/routes.tsx"
import * as Studio from "../../src/studio/Studio.ts"
import type * as StudioStore from "../../src/studio/StudioStore.ts"

const tree = Route.map({ "/studio": routes })

const studioLayer = (auth: Studio.Studio["Type"]["auth"]) =>
  Layer.effect(
    Studio.Studio,
    Effect.gen(function*() {
      return {
        path: "/studio",
        auth,
        store: {
          events: yield* PubSub.unbounded<StudioStore.StudioEvent>(),
          spanCapacity: 0,
          logCapacity: 0,
          errorCapacity: 0,
          process: undefined,
        },
      }
    }),
  )

const bundleLayer = Layer.succeed(Bundle.Bundle, {
  ...Bundle.emptyBundleContext,
  resolve: (path) => `/_bundle/${path}`,
})

const runWithAuth = (
  auth: Studio.Studio["Type"]["auth"],
  perform: (client: Fetch.FetchClient) => Effect.Effect<void, any, never>,
) =>
  Effect
    .gen(function*() {
      const runtime = yield* Effect.runtime<never>()
      const handles = Object.fromEntries(RouteHttp.walkHandles(tree, runtime))
      const handler = handles["/studio/services"]
      yield* perform(Fetch.fromHandler(handler))
    })
    .pipe(
      Effect.provide(Layer.mergeAll(studioLayer(auth), bundleLayer)),
      Effect.runPromise,
    )

test.describe("studio layer basic auth", () => {
  test.it("does not require auth when auth option is undefined", () =>
    runWithAuth(undefined, (client) =>
      Effect.gen(function*() {
        const entity = yield* client.get("http://localhost/studio/services")

        test.expect(entity.status)
          .toBe(200)
        test.expect(yield* entity.text)
          .toContain("Services")
      })))

  test.it("returns 401 with WWW-Authenticate header when no credentials sent", () =>
    runWithAuth(
      { type: "basic", username: "admin", password: "s3cret" },
      (client) =>
        Effect.gen(function*() {
          const entity = yield* client.get("http://localhost/studio/services")

          test.expect(entity.status)
            .toBe(401)
          test.expect(entity.headers["www-authenticate"])
            .toBe(
            "Basic realm=\"Studio\", charset=\"UTF-8\"",
          )
          test.expect(yield* entity.text).not
            .toContain("Services")
        }),
    ))

  test.it("returns 401 when credentials are wrong", () =>
    runWithAuth(
      { type: "basic", username: "admin", password: "s3cret" },
      (client) =>
        Effect.gen(function*() {
          const wrong = "Basic " + btoa("admin:wrong")
          const entity = yield* client.get(
            "http://localhost/studio/services",
            { headers: { authorization: wrong } },
          )

          test.expect(entity.status)
            .toBe(401)
        }),
    ))

  test.it("passes through with 200 when credentials are correct", () =>
    runWithAuth(
      { type: "basic", username: "admin", password: "s3cret" },
      (client) =>
        Effect.gen(function*() {
          const ok = "Basic " + btoa("admin:s3cret")
          const entity = yield* client.get(
            "http://localhost/studio/services",
            { headers: { authorization: ok } },
          )

          test.expect(entity.status)
            .toBe(200)
          test.expect(yield* entity.text)
            .toContain("Services")
        }),
    ))
})
