import type * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export interface RouteContext {
  readonly request: HttpServerRequest.HttpServerRequest
  readonly url: URL
  readonly path: string
  readonly params: Record<string, string>
  readonly clientModuleUrl?: string
  readonly slots: Record<string, any>
}

export class Route extends Context.Tag("effect-start/Route")<
  Route,
  RouteContext
>() {}

export interface LayoutContext<T = unknown> {
  readonly children: T
  readonly slots: Record<string, any>
  readonly route: RouteContext
}

export interface LayoutWrapper {
  readonly wrap: <T>(
    children: T,
  ) => Effect.Effect<any, never, Route>
}

export class LayoutService extends Context.Tag("effect-start/LayoutService")<
  LayoutService,
  LayoutWrapper
>() {}

export type LayoutHandler = <T>(
  ctx: LayoutContext<T>,
) => Effect.Effect<any, never, never>

export const makeLayoutLayer = (
  handler: LayoutHandler,
): Layer.Layer<LayoutService, never, never> =>
  Layer.succeed(LayoutService, {
    wrap: (children) =>
      Effect.gen(function*() {
        const route = yield* Route
        return yield* handler({ children, slots: route.slots, route })
      }),
  })

export type LayerComponent = Layer.Layer<any, never, never>
