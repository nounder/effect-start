import * as Data from "effect/Data"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import type * as Types from "effect/Types"
import * as Route from "./Route.ts"
import * as RouteSet from "./RouteSet.ts"

type RouterModule = typeof import("./Router.ts")

type Self =
  | Router.Any
  | RouterModule
  | undefined

export type RouterErrorReason =
  | "UnsupportedPattern"
  | "ProxyError"

export class RouterError extends Data.TaggedError("RouterError")<{
  reason: RouterErrorReason
  pattern: string
  message: string
}> {}

const TypeId: unique symbol = Symbol.for(
  "effect-start/Router",
)

type Methods = {
  use: typeof use
  mount: typeof mount
}

export type RouterMounts = {
  readonly [K in `/${string}`]?: RouteSet.RouteSet.Any
}

export interface Router<
  out Mounts extends RouterMounts = RouterMounts,
  out Layer extends RouteSet.RouteSet.Any = RouteSet.RouteSet.Any,
> extends Pipeable.Pipeable, Methods {
  [TypeId]: typeof TypeId
  [RouteSet.TypeId]: typeof RouteSet.TypeId
  readonly mounts: Mounts
  readonly layer: Layer
  readonly set: Route.Route.Default[]
  readonly schema: Route.RouteSchemas
}

export namespace Router {
  export type Any = Router<any, any>

  export type Mounts<T> = T extends Router<infer M, any> ? M : never

  export type Layer<T> = T extends Router<any, infer L> ? L : never

  export type ExtractRouteSetError<T> = T extends
    RouteSet.RouteSet<infer Routes, any>
    ? Routes[number] extends Route.Route<any, any, infer H, any>
      ? H extends Route.RouteHandler<any, infer E, any> ? E : never
    : never
    : never

  export type ExtractRouteSetRequirements<T> = T extends
    RouteSet.RouteSet<infer Routes, any>
    ? Routes[number] extends Route.Route<any, any, infer H, any>
      ? H extends Route.RouteHandler<any, any, infer R> ? R : never
    : never
    : never

  export type Error<T> = T extends Router<infer M, infer L> ? {
      [K in keyof M]: M[K] extends RouteSet.RouteSet.Any ? ExtractRouteSetError<M[K]>
        : never
    }[keyof M] | ExtractRouteSetError<L>
    : never

  export type Requirements<T> = T extends Router<infer M, infer L> ? {
      [K in keyof M]: M[K] extends RouteSet.RouteSet.Any
        ? ExtractRouteSetRequirements<M[K]>
        : never
    }[keyof M] | ExtractRouteSetRequirements<L>
    : never

  export type Entry<
    Path extends `/${string}` = `/${string}`,
    Set extends RouteSet.RouteSet.Any = RouteSet.RouteSet.Any,
  > = {
    readonly path: Path
    readonly routes: Set
  }

  export type Entries<T> = T extends Router<infer M, any> ? {
      [K in keyof M]: K extends `/${string}`
        ? M[K] extends RouteSet.RouteSet.Any ? Entry<K, M[K]>
        : never
        : never
    }[keyof M]
    : never

  export type MergeMounts<
    Existing extends RouterMounts,
    Path extends `/${string}`,
    NewSet extends RouteSet.RouteSet.Any,
  > = {
    readonly [K in keyof Existing | Path]: K extends Path
      ? K extends keyof Existing
        ? Existing[K] extends RouteSet.RouteSet.Any
          ? Route.Merge<Existing[K], NewSet>
        : NewSet
        : NewSet
      : K extends keyof Existing
        ? Existing[K]
      : never
  }
}

const Proto: Methods & {
  [TypeId]: typeof TypeId
  pipe: Pipeable.Pipeable["pipe"]
  schema: Route.RouteSchemas
} = {
  [TypeId]: TypeId,

  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },

  get schema(): Route.RouteSchemas {
    return {}
  },

  use,
  mount,
}

export function make<
  Mounts extends RouterMounts,
  Layer extends RouteSet.RouteSet.Any = RouteSet.RouteSet<[]>,
>(
  mounts: Mounts,
  layer: Layer = RouteSet.make() as Layer,
): Router<Mounts, Layer> {
  return Object.assign(
    Object.create(Proto),
    {
      mounts,
      layer,
    },
  ) as Router<Mounts, Layer>
}

export function isRouter(input: unknown): input is Router.Any {
  return Predicate.hasProperty(input, TypeId)
}

export function use<
  S extends Self,
  Routes extends Route.Route.Array,
  Schemas extends Route.RouteSchemas,
>(
  this: S,
  route: RouteSet.RouteSet<Routes, Schemas>,
): S extends Router<infer M, infer L>
  ? Router<M, Route.Merge<L, RouteSet.RouteSet<Routes, Schemas>>>
  : Router<{}, RouteSet.RouteSet<Routes, Schemas>>
{
  const router = isRouter(this)
    ? this
    : make({}, RouteSet.make())

  const newLayer = Route.merge(router.layer, route)

  return make(router.mounts, newLayer) as any
}

export function mount<
  S extends Self,
  Path extends `/${string}`,
  Routes extends Route.Route.Array,
  Schemas extends Route.RouteSchemas,
>(
  this: S,
  path: Path,
  route: RouteSet.RouteSet<Routes, Schemas>,
): S extends Router<infer M, infer L>
  ? Router<
    Router.MergeMounts<M, Path, Route.Merge<L, RouteSet.RouteSet<Routes, Schemas>>>,
    L
  >
  : Router<
    { readonly [K in Path]: RouteSet.RouteSet<Routes, Schemas> },
    RouteSet.RouteSet<[]>
  >
{
  const router = isRouter(this)
    ? this
    : make({}, RouteSet.make())

  const mergedRouteSet = Route.merge(router.layer, route)

  const existingRouteSet = router.mounts[path]
  const finalRouteSet = existingRouteSet
    ? Route.merge(existingRouteSet, mergedRouteSet)
    : mergedRouteSet

  return make(
    { ...router.mounts, [path]: finalRouteSet },
    router.layer,
  ) as any
}

export function get(
  router: Router.Any,
  method: Route.RouteMethod,
  path: `/${string}`,
  kind?: Route.RouteKind,
): Route.Route.Default | undefined {
  const routeSet = router.mounts[path]
  if (!routeSet) return undefined

  const methodMatching = RouteSet.items(routeSet).filter((route) => {
    return method === "*"
      || route.method === "*"
      || route.method === method
  })

  if (methodMatching.length === 0) return undefined

  if (kind === undefined) {
    return methodMatching[0]
  }

  return methodMatching.find((route) => route.kind === kind)
}

export function entries<T extends Router.Any>(
  router: T,
): Router.Entries<T>[] {
  const result: Array<{ path: `/${string}`; routes: RouteSet.RouteSet.Any }> =
    []

  for (const path of Object.keys(router.mounts)) {
    const routeSet = router.mounts[path as `/${string}`]
    if (routeSet) {
      result.push({
        path: path as `/${string}`,
        routes: routeSet,
      })
    }
  }

  return result as Router.Entries<T>[]
}
