import type * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export interface RouteInfo {
  readonly request: HttpServerRequest.HttpServerRequest
  readonly url: URL
  readonly path: string
  readonly params: Record<string, string>
  readonly clientModuleUrl?: string
  readonly context: Map<string, unknown>
}

export class Route extends Context.Tag("effect-start/Route")<
  Route,
  RouteInfo
>() {}

export interface LayoutContext<T = unknown> {
  readonly children: T
  readonly route: RouteInfo
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
        return yield* handler({ children, route })
      }),
  })

export type LayerComponent = Layer.Layer<any, never, never>
