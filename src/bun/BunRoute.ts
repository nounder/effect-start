import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import { type HTMLBundle } from "bun"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Predicate from "effect/Predicate"
import * as Route from "../Route.ts"
import * as Router from "../Router.ts"
import * as BunRouteSyntax from "./BunRouteSyntax.ts"

const TypeId: unique symbol = Symbol.for("effect-start/BunRoute")

export type BunRoute =
  & Route.Route
  & {
    [TypeId]: typeof TypeId
    load: () => Promise<HTMLBundle>
  }

export function loadBundle(
  load: () => Promise<HTMLBundle | { default: HTMLBundle }>,
): BunRoute {
  const route = Route.make({
    method: "GET",
    media: "text/html",
    handler: HttpServerResponse.text("Empty BunRoute"),
    schemas: {},
  })

  const bunRoute: BunRoute = Object.assign(
    Object.create(route),
    {
      [TypeId]: TypeId,
      load: () => load().then(mod => "default" in mod ? mod.default : mod),
    },
  )

  bunRoute.set = [bunRoute]

  return bunRoute
}

export function isBunRoute(input: unknown): input is BunRoute {
  return Predicate.hasProperty(input, TypeId)
}

/**
 * Finds BunRoutes in the Router and returns
 * a mapping of paths to their bundles that can be passed
 * to Bun's `serve` function.
 */
export function bundlesFromRouter(
  router: Router.RouterContext,
): Effect.Effect<Record<string, HTMLBundle>> {
  return Function.pipe(
    Effect.forEach(
      router.modules,
      (mod) =>
        Effect.promise(() =>
          mod.load().then((m) => ({ path: mod.path, exported: m.default }))
        ),
    ),
    Effect.map((modules) =>
      modules.flatMap(({ path, exported }) => {
        if (Route.isRouteSet(exported)) {
          return [...exported.set]
            .filter(isBunRoute)
            .map((route) =>
              [
                path,
                route,
              ] as const
            )
        }

        return []
      })
    ),
    Effect.flatMap((bunRoutes) =>
      Effect.forEach(
        bunRoutes,
        ([path, route]) =>
          Effect.promise(() =>
            route.load().then((bundle) => {
              const bunPath = BunRouteSyntax.toBunPath(path)

              return [bunPath, bundle] as const
            })
          ),
        { concurrency: "unbounded" },
      )
    ),
    Effect.map((entries) =>
      Object.fromEntries(entries) as Record<string, HTMLBundle>
    ),
  )
}
