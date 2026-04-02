/**
 * Cross-Site Request Forgery (CSRF) protection middleware.
 *
 * CSRF is an attack where a malicious site tricks a user's browser into making
 * a request to your app. For example, a hidden form on `evil.com` could
 * POST to `yourapp.com/transfer?amount=1000` and the browser would send the
 * user's cookies along with it.
 *
 * All modern browsers send the `Sec-Fetch-Site` header on every request.
 *
 * If the header is present, this middleware enforces it.
 * Otherwise, the request isn't coming from a browser, so there's no CSRF risk
 * and it passes through. This means curl and API clients are never blocked.
 *
 * `Sec-Fetch-Site` tells the server where a request came from:
 * - `same-origin` — the request came from the same origin (scheme + host + port)
 * - `same-site` — the request came from a subdomain of the same site
 * - `cross-site` — the request came from a completely different site
 * - `none` — the user navigated directly (e.g. typing in the address bar)
 *
 * Unlike traditional CSRF token approaches (hidden form fields, session-stored
 * tokens), this requires no server-side state and no client-side plumbing.
 *
 * @example
 * ```ts
 * // in route layer
 * Route.use(
 *   CsrfProtection.make(),
 * )
 * ```
 */

import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Entity from "../Entity.ts"
import * as Route from "../Route.ts"

export class CsrfError extends Data.TaggedError("CsrfError")<{
  readonly reason: string
}> {}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"])

export interface Options {
  /**
   * Origins that are allowed to make cross-site requests.
   *
   * Normally a request from `https://accounts.google.com` to your app would be
   * blocked because `Sec-Fetch-Site` is `cross-site`. Adding it here whitelists
   * that origin. Useful for OAuth callbacks, third-party payment providers, or
   * any external service that POSTs back to your app.
   *
   * Must be exact origin strings including scheme (e.g. `"https://example.com"`).
   */
  readonly trustedOrigins?: ReadonlyArray<string>

  /**
   * Whether to accept `Sec-Fetch-Site: same-site` in addition to `same-origin`.
   * Defaults to `true`.
   *
   * `same-origin` means the request came from exactly the same scheme + host + port.
   * `same-site` means it came from a different subdomain of the same registrable
   * domain (e.g. `dashboard.example.com` → `api.example.com`).
   *
   * Set to `false` if your subdomains are untrusted (e.g. user-generated content
   * on `*.example.com`) and you want to reject requests from sibling subdomains.
   */
  readonly allowSameSite?: boolean

}

function originTrusted(request: Request, trustedOrigins: ReadonlyArray<string>): boolean {
  const origin = request.headers.get("origin")
  return origin !== null && origin !== "" && trustedOrigins.includes(origin)
}

function originMatchesBase(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (origin === null || origin === "") return true
  const url = new URL(request.url)
  const base = `${url.protocol}//${url.host}`
  return origin === base
}

function reject(reason: string): Entity.Entity<string> {
  return Entity.make(JSON.stringify({ error: reason }, null, 2), {
    status: 403,
    headers: { "content-type": "application/json" },
  })
}

export function make(options?: Options) {
  const trustedOrigins = options?.trustedOrigins ?? []
  const allowSameSite = options?.allowSameSite ?? true
  const safeFetchSites = allowSameSite
    ? new Set(["same-origin", "same-site"])
    : new Set(["same-origin"])

  return <D extends Route.RouteDescriptor.Any, SB extends {}, P extends Route.Route.Tuple>(
    self: Route.RouteSet<D, SB, P>,
  ): Route.RouteSet<D, SB, [...P, Route.Route<{}, {}, unknown, never, Route.Request>]> => {
    const route = Route.make<{}, {}, unknown, never, Route.Request>((_context, next) =>
      Effect.gen(function* () {
        const request = yield* Route.Request
        const method = request.method.toUpperCase()

        if (SAFE_METHODS.has(method)) {
          return yield* next()
        }

        const secFetchSite = request.headers.get("sec-fetch-site")

        if (secFetchSite === null) {
          return yield* next()
        }

        if (!originMatchesBase(request) && !originTrusted(request, trustedOrigins)) {
          const origin = request.headers.get("origin")
          const url = new URL(request.url)
          const base = `${url.protocol}//${url.host}`
          return reject(`HTTP Origin header (${origin}) didn't match request.base_url (${base})`)
        }

        const value = secFetchSite.toLowerCase()

        if (safeFetchSites.has(value)) {
          const entity = yield* next()
          return Entity.merge(entity, {
            headers: { vary: "Sec-Fetch-Site" },
          })
        }

        if (value === "cross-site" && originTrusted(request, trustedOrigins)) {
          const entity = yield* next()
          return Entity.merge(entity, {
            headers: { vary: "Sec-Fetch-Site" },
          })
        }

        return reject(
          value === "cross-site"
            ? "Sec-Fetch-Site header (cross-site) indicates a cross-site request"
            : `Sec-Fetch-Site header is invalid (${JSON.stringify(value)})`,
        )
      }),
    )

    return Route.set(
      [...Route.items(self), route] as [...P, Route.Route<{}, {}, unknown, never, Route.Request>],
      Route.descriptor(self),
    )
  }
}
