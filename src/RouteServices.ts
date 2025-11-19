import type * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FiberRef from "effect/FiberRef"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"

export interface RouteInfo {
  readonly request: HttpServerRequest.HttpServerRequest
  readonly url: URL
  readonly path: string
  readonly params: Record<string, string>
  readonly clientModuleUrl?: string
}

export class Route extends Context.Tag("effect-start/Route")<
  Route,
  RouteInfo
>() {}

export interface LayoutWrapper {
  readonly wrap: <T>(
    children: T,
  ) => Effect.Effect<any, never, Route>
}

export class LayoutService extends Context.Tag("effect-start/LayoutService")<
  LayoutService,
  LayoutWrapper
>() {}

const SlotsRef: FiberRef.FiberRef<Map<string, unknown>> = FiberRef.unsafeMake(
  new Map(),
)

export interface MetadataService {
  readonly set: (key: string, value: unknown) => Effect.Effect<void>
  readonly get: (key: string) => Effect.Effect<Option.Option<unknown>>
  readonly unsafeGet: (key: string) => unknown | undefined
}

export class RouteMetadata extends Context.Tag("effect-start/RouteMetadata")<
  RouteMetadata,
  MetadataService
>() {
  static readonly Live = Layer.sync(RouteMetadata, () => ({
    set: (key: string, value: unknown) =>
      FiberRef.update(SlotsRef, (map) => {
        const newMap = new Map(map)
        newMap.set(key, value)
        return newMap
      }),

    get: (key: string) =>
      FiberRef.get(SlotsRef).pipe(
        Effect.map((map) => Option.fromNullable(map.get(key))),
      ),

    unsafeGet: (key: string) => {
      throw new Error(
        "slots.unsafeGet can only be called within an Effect execution context",
      )
    },
  }))
}

export type LayoutHandler = <T>(props: {
  readonly children: T
}) => Effect.Effect<any, never, Route>

export const makeLayoutLayer = (
  handler: LayoutHandler,
): Layer.Layer<LayoutService, never, never> =>
  Layer.succeed(LayoutService, {
    wrap: (children) => handler({ children }),
  })

export type LayerComponent = Layer.Layer<any, never, never>
