import * as HttpApp from "@effect/platform/HttpApp"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Function from "effect/Function"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Ref from "effect/Ref"

type StartMiddleware = <E, R>(
  self: HttpApp.Default<E, R>,
) => HttpApp.Default<never, never>

export class StartApp extends Context.Tag("effect-start/StartApp")<
  StartApp,
  {
    readonly env: "development" | "production" | string
    readonly addMiddleware: (
      middleware: StartMiddleware,
    ) => Effect.Effect<void>
    readonly middleware: Ref.Ref<StartMiddleware>
    readonly events: PubSub.PubSub<any>
  }
>() {
}

export function layer(options?: {
  env?: string
}) {
  return Layer.effect(
    StartApp,
    Effect.gen(function*() {
      const env = options?.env ?? process.env.NODE_ENV ?? "development"
      const middleware = yield* Ref.make(
        Function.identity as StartMiddleware,
      )
      const events = yield* PubSub.unbounded()

      return StartApp.of({
        env,
        middleware,
        addMiddleware: (f) =>
          Ref.update(middleware, (prev) => (app) => f(prev(app))),
        events,
      })
    }),
  )
}
