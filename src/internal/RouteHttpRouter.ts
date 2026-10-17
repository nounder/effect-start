import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"
import type * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import type * as Scope from "effect/Scope"

export class Fallback extends Context.Service<
  Fallback,
  Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    unknown,
    HttpServerRequest.HttpServerRequest | Scope.Scope
  >
>()("effect-start/RouteHttpRouter/Fallback") {}

export const make = (build: Effect.Effect<HttpRouter.HttpRouter>) =>
  Effect.gen(function*() {
    const context = yield* Effect.context<never>()
    let initialized: HttpRouter.HttpRouter | undefined
    const get = yield* Effect.cached(build.pipe(
      Effect.provide(context),
      Effect.tap((router) =>
        Effect.sync(() => {
          initialized = router
        })
      ),
    ))

    const prefixed = (prefixes: ReadonlyArray<string>): HttpRouter.HttpRouter => {
      const resolve = Effect.map(get, (router) => {
        for (const prefix of prefixes) router = router.prefixed(prefix)
        return router
      })
      return HttpRouter.HttpRouter.of({
        "~effect/http/HttpRouter": "~effect/http/HttpRouter",
        prefixed: (prefix) => prefixed([...prefixes, prefix]),
        add: (...args) => Effect.flatMap(resolve, (router) => router.add(...args)),
        addAll: (routes) => Effect.flatMap(resolve, (router) => router.addAll(routes)),
        addGlobalMiddleware: (middleware) =>
          Effect.flatMap(resolve, (router) => router.addGlobalMiddleware(middleware)),
        asHttpEffect: () => Effect.flatMap(resolve, (router) => router.asHttpEffect()),
      })
    }

    return Context.make(HttpRouter.HttpRouter, prefixed([])).pipe(
      Context.add(
        Fallback,
        Effect.suspend(() =>
          initialized === undefined
            ? Effect.succeed(HttpServerResponse.text("not found", { status: 404 }))
            : initialized.asHttpEffect()
        ),
      ),
    )
  })
