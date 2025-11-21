import type * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"

export interface RouteSlots {
  title?: string
  description?: string
  [key: string]: any
}

export interface RouteContext {
  readonly request: HttpServerRequest.HttpServerRequest
  readonly url: URL
  readonly path: string
  readonly params: Record<string, string>
  readonly clientModuleUrl?: string
  readonly slots: RouteSlots
}

export class Route extends Context.Tag("effect-start/Route")<
  Route,
  RouteContext
>() {}

export type LayerComponent = Layer.Layer<any, never, never>
