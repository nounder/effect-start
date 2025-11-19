import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PostHogService from "./PostHogService.ts"

export function withPostHog(
  config: PostHogService.PostHogConfig,
): <E, R>(app: HttpApp.Default<E, R>) => HttpApp.Default<E, Exclude<R, PostHogService.PostHog>> {
  return HttpMiddleware.make((app) =>
    Effect.provide(
      app,
      PostHogService.layer(config),
    )
  )
}
