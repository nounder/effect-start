import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpRouter from "effect/http/HttpRouter"

export const make = (build: Effect.Effect<HttpRouter.HttpRouter>) =>
  Effect.gen(function*() {
    const context = yield* Effect.context<never>()
    const get = yield* Effect.cached(Effect.provide(build, context))

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

    return Context.make(HttpRouter.HttpRouter, prefixed([]))
  })
