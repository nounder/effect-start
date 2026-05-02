import type * as PathPattern from "./internal/PathPattern.ts"
import type * as Route from "./Route.ts"
import type { Routes as DevRoutes } from "effect-start/dev"

export type LinkParams<
  Routes,
  P extends string,
  B = P extends keyof Routes
    ? Routes[P] extends [...any[], infer L] // last route
      ? L extends () => Promise<{ default: infer R extends Route.RouteSet.Any }>
        ? Route.Route.Bindings<R>
        : {}
      : {}
    : {},
> = {
  [K in keyof PathPattern.Params<P>]: B extends { pathParams: infer S }
    ? K extends keyof S
      ? S[K]
      : string | number
    : string | number
} & (B extends { searchParams: infer S } ? { [K in keyof S]?: S[K] } : {})

export function link<
  Routes = DevRoutes,
  P extends keyof Routes extends never
    ? // Falls back to any string when no routes are registered
      string
    : keyof Routes & string = keyof Routes extends never ? string : keyof Routes & string,
>(
  ...args: {} extends LinkParams<Routes, P>
    ? [path: P, params?: LinkParams<Routes, P>]
    : [path: P, params: LinkParams<Routes, P>]
): string {
  const path = args[0] as string
  // Substitute path params, deleting used keys so the rest become search params
  const remaining = { ...args[1] } as Record<string, string | number | undefined>
  const result = path.replace(
    /\/:(\w+)([?*+])?/g,
    (_, name: string, modifier: string | undefined) => {
      const value = remaining[name]
      delete remaining[name]
      if (value == null) {
        if (modifier === "?" || modifier === "*") return ""
        return "/"
      }
      return "/" + encodeURIComponent(String(value))
    },
  )

  const search = new URLSearchParams()
  for (const key in remaining) {
    if (remaining[key] != null) search.set(key, String(remaining[key]))
  }
  const qs = search.toString()
  return qs ? result + "?" + qs : result
}
