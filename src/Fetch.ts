import * as Effect from "effect/Effect"
import type * as Utils from "effect/Utils"
import * as Entity from "./Entity.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchError {
  readonly _tag: "FetchError"
  readonly request: Request
  readonly reason: "Transport" | "Decode"
  readonly cause: unknown
}

export function FetchError(
  request: Request,
  reason: FetchError["reason"],
  cause: unknown,
): FetchError {
  return { _tag: "FetchError", request, reason, cause }
}

export type Middleware<E = never, R = never> = (
  request: Request,
  next: (request: Request) => Effect.Effect<Entity.Entity<string>, FetchError>,
) => Effect.Effect<Entity.Entity<string>, FetchError | E, R>

type YieldError<T> = T extends Utils.YieldWrap<Effect.Effect<any, infer E, any>> ? E : never

type YieldContext<T> = T extends Utils.YieldWrap<Effect.Effect<any, any, infer R>> ? R : never

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function executeRequest(request: Request): Effect.Effect<Entity.Entity<string>, FetchError> {
  return Effect.tryPromise({
    try: (signal) => globalThis.fetch(request, { signal }),
    catch: (cause) => FetchError(request, "Transport", cause),
  }).pipe(
    Effect.flatMap((response) => {
      const headers: Entity.Headers = {}
      response.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v
      })
      const opts = { status: response.status, url: response.url, headers }
      if (response.status === 204 || response.status === 304 || response.body === null) {
        return Effect.succeed(Entity.make("", opts))
      }
      return Effect.tryPromise({
        try: () => response.text(),
        catch: (cause) => FetchError(request, "Decode", cause),
      }).pipe(Effect.map((text) => Entity.make(text, opts)))
    }),
  )
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface Client {
  readonly execute: (request: Request) => Effect.Effect<Entity.Entity<string>, FetchError>
}

export function make(...middlewares: Array<Middleware<any, any>>): Client {
  return {
    execute(request) {
      return runChain(request, middlewares, 0)
    },
  }
}

function runChain(
  request: Request,
  middlewares: Array<Middleware<any, any>>,
  index: number,
): Effect.Effect<Entity.Entity<string>, FetchError> {
  if (index >= middlewares.length) {
    return executeRequest(request)
  }
  const mw = middlewares[index]
  return mw(request, (req) => runChain(req, middlewares, index + 1)) as Effect.Effect<
    Entity.Entity<string>,
    FetchError
  >
}

// ---------------------------------------------------------------------------
// Default client (no middleware)
// ---------------------------------------------------------------------------

export const client: Client = make()

// ---------------------------------------------------------------------------
// Convenience: one-shot fetch as Effect
// ---------------------------------------------------------------------------

export function fetch(
  input: string | URL | Request,
  init?: RequestInit,
): Effect.Effect<Entity.Entity<string>, FetchError> {
  const request = input instanceof Request ? input : new Request(input, init)
  return executeRequest(request)
}

// ---------------------------------------------------------------------------
// Effect.gen middleware helper
// ---------------------------------------------------------------------------

export function middleware<Y extends Utils.YieldWrap<Effect.Effect<any, any, any>>>(
  handler: (
    request: Request,
    next: (request: Request) => Effect.Effect<Entity.Entity<string>, FetchError>,
  ) => Generator<Y, Entity.Entity<string>, never>,
): Middleware<YieldError<Y>, YieldContext<Y>> {
  return (request, next) => {
    const gen = handler(request, next)
    return Effect.gen(function* () {
      return yield* gen
    }) as any
  }
}

// ---------------------------------------------------------------------------
// Common middlewares
// ---------------------------------------------------------------------------

export function baseUrl(base: string): Middleware {
  return (request, next) => {
    const url = new URL(request.url, base)
    return next(new Request(url, request))
  }
}

export function setHeader(name: string, value: string): Middleware {
  return (request, next) => {
    const headers = new Headers(request.headers)
    headers.set(name, value)
    return next(new Request(request, { headers }))
  }
}

export function setHeaders(headers: Record<string, string>): Middleware {
  return (request, next) => {
    const h = new Headers(request.headers)
    for (const [k, v] of Object.entries(headers)) {
      h.set(k, v)
    }
    return next(new Request(request, { headers: h }))
  }
}

export function bearerToken(token: string): Middleware {
  return setHeader("authorization", `Bearer ${token}`)
}

export function timeout(ms: number): Middleware {
  return (request, next) =>
    Effect.timeout(next(request), ms) as Effect.Effect<Entity.Entity<string>, FetchError>
}

export function retry(options: { times: number; delay?: number }): Middleware {
  return (request, next) =>
    Effect.retry(next(request), {
      times: options.times,
      ...(options.delay != null ? { schedule: Effect.scheduleSpaced(options.delay) } : {}),
    }) as Effect.Effect<Entity.Entity<string>, FetchError>
}

export function tap(
  f: (entity: Entity.Entity<string>) => void | Effect.Effect<void, never, never>,
): Middleware {
  return (request, next) =>
    Effect.tap(next(request), (entity) => {
      const result = f(entity)
      return Effect.isEffect(result) ? result : Effect.void
    })
}

