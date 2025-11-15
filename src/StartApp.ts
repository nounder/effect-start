import { HttpApp } from "@effect/platform"
import {
  Context,
  Effect,
  Layer,
  Ref,
} from "effect"
import * as Function from "effect/Function"

type NewType = HttpApp.Default<never, never>

type StartMiddleware = <E, R>(
  self: HttpApp.Default<E, R>,
) => NewType

export class StartApp extends Context.Tag("effect-start/StartApp")<
  StartApp,
  {
    readonly env: "development" | "production" | string
    readonly relativeUrlRoot?: string
    readonly addMiddleware: (
      middleware: StartMiddleware,
    ) => Effect.Effect<void>
    readonly middleware: Ref.Ref<StartMiddleware>
  }
>() {
}

export function layer(options?: {
  env?: string
}) {
  return Layer.sync(StartApp, () => {
    const env = options?.env ?? process.env.NODE_ENV ?? "development"
    const middleware = Ref.unsafeMake(
      Function.identity as StartMiddleware,
    )

    return StartApp.of({
      env,
      middleware,
      addMiddleware: (f) =>
        Ref.update(middleware, (prev) => (app) => f(prev(app))),
    })
  })
}
