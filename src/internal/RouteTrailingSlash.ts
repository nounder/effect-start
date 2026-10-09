import * as Effect from "effect/Effect"
import * as Entity from "../Entity.ts"
import * as Route from "../Route.ts"

export interface Options {
  /**
   * Whether the canonical form strips ("strip") or adds ("append") the
   * trailing slash. Defaults to `"strip"`.
   *
   * The root path `/` is always left untouched regardless of mode, since it
   * cannot be stripped any further.
   */
  readonly mode?: "strip" | "append"

  /**
   * Redirect status code. Defaults to `308` (Permanent Redirect), which
   * preserves the original request method and body — important since this
   * middleware also applies to non-GET requests. Use `301` if you need the
   * traditional (method-downgrading) permanent redirect instead.
   */
  readonly status?: 301 | 308
}

function canonicalPathname(
  pathname: string,
  mode: "strip" | "append",
): string | undefined {
  if (pathname === "/") return undefined

  const hasTrailingSlash = pathname.endsWith("/")

  if (mode === "strip") {
    return hasTrailingSlash ? pathname.slice(0, -1) : undefined
  }

  return hasTrailingSlash ? undefined : `${pathname}/`
}

export function make(options?: Options) {
  const mode = options?.mode ?? "strip"
  const status = options?.status ?? 308

  return <D, SB, P extends Route.Route.Tuple>(
    self: Route.RouteSet<D, SB, P>,
  ): Route.RouteSet<
    D,
    SB,
    [...P, Route.Route<{}, {}, unknown, never, Route.Request>]
  > => {
    const route = Route.make<{}, {}, unknown, never, Route.Request>((
      _context,
      next,
    ) =>
      Effect.gen(function*() {
        const request = yield* Route.Request
        const url = new URL(request.url)
        const canonical = canonicalPathname(url.pathname, mode)

        if (canonical === undefined) {
          return yield* next
        }

        url.pathname = canonical
        return Entity.make("", {
          status,
          headers: { location: url.pathname + url.search },
        })
      })
    )

    return Route.set(
      [...Route.items(self), route] as [
        ...P,
        Route.Route<{}, {}, unknown, never, Route.Request>,
      ],
      Route.descriptor(self),
    )
  }
}
