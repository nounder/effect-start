import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import * as Schedule from "effect/Schedule"
import type * as Utils from "effect/Utils"
import * as Entity from "./Entity.ts"

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const TypeId: unique symbol = Symbol.for("effect-start/FetchError")

export const isFetchError = (u: unknown): u is FetchError => Predicate.hasProperty(u, TypeId)

export class FetchError extends Data.TaggedError("FetchError")<{
  readonly reason: FetchErrorReason
}> {
  readonly [TypeId] = TypeId

  get request(): Request {
    return this.reason.request
  }

  override get message(): string {
    return this.reason.message
  }
}

const methodAndUrl = (request: Request) => `${request.method} ${request.url}`

const formatMessage = (tag: string, description: string | undefined, info: string) =>
  description ? `${tag}: ${description} (${info})` : `${tag} (${info})`

export class TransportError extends Data.TaggedError("TransportError")<{
  readonly request: Request
  readonly cause?: unknown
  readonly description?: string
}> {
  override get message() {
    return formatMessage("Transport", this.description, methodAndUrl(this.request))
  }
}

export class DecodeError extends Data.TaggedError("DecodeError")<{
  readonly request: Request
  readonly cause?: unknown
  readonly description?: string
}> {
  override get message() {
    return formatMessage("Decode", this.description, methodAndUrl(this.request))
  }
}

export class StatusError extends Data.TaggedError("StatusError")<{
  readonly request: Request
  readonly status: number
  readonly description?: string
}> {
  override get message() {
    return formatMessage("Status", this.description, `${this.status} ${methodAndUrl(this.request)}`)
  }
}

export type FetchErrorReason = TransportError | DecodeError | StatusError

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Middleware<E = never, R = never> = (
  request: Request,
  next: (request: Request) => Effect.Effect<Entity.Entity<Uint8Array>, FetchError>,
) => Effect.Effect<Entity.Entity<Uint8Array>, FetchError | E, R>

type YieldError<T> = T extends Utils.YieldWrap<Effect.Effect<any, infer E, any>> ? E : never

type YieldContext<T> = T extends Utils.YieldWrap<Effect.Effect<any, any, infer R>> ? R : never

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function executeRequest(request: Request): Effect.Effect<Entity.Entity<Uint8Array>, FetchError> {
  return Effect.tryPromise({
    try: (signal) => globalThis.fetch(request, { signal }),
    catch: (cause) => new FetchError({ reason: new TransportError({ request, cause }) }),
  }).pipe(
    Effect.flatMap((response) => {
      const headers: Entity.Headers = {}
      response.headers.forEach((v, k) => {
        headers[k.toLowerCase()] = v
      })
      const opts = { status: response.status, url: response.url, headers }
      if (response.status === 204 || response.status === 304 || response.body === null) {
        return Effect.succeed(Entity.make(new Uint8Array(0), opts))
      }
      return Effect.tryPromise({
        try: () => response.arrayBuffer(),
        catch: (cause) => new FetchError({ reason: new DecodeError({ request, cause }) }),
      }).pipe(Effect.map((buf) => Entity.make(new Uint8Array(buf), opts)))
    }),
  )
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface Client {
  readonly execute: (request: Request) => Effect.Effect<Entity.Entity<Uint8Array>, FetchError>
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
): Effect.Effect<Entity.Entity<Uint8Array>, FetchError> {
  if (index >= middlewares.length) {
    return executeRequest(request)
  }
  const mw = middlewares[index]
  return mw(request, (req) => runChain(req, middlewares, index + 1)) as Effect.Effect<
    Entity.Entity<Uint8Array>,
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
): Effect.Effect<Entity.Entity<Uint8Array>, FetchError> {
  const request = input instanceof Request ? input : new Request(input, init)
  return executeRequest(request)
}

// ---------------------------------------------------------------------------
// Effect.gen middleware helper
// ---------------------------------------------------------------------------

export function middleware<Y extends Utils.YieldWrap<Effect.Effect<any, any, any>>>(
  handler: (
    request: Request,
    next: (request: Request) => Effect.Effect<Entity.Entity<Uint8Array>, FetchError>,
  ) => Generator<Y, Entity.Entity<Uint8Array>, never>,
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
    Effect.timeout(next(request), ms) as Effect.Effect<Entity.Entity<Uint8Array>, FetchError>
}

export function retry(
  options:
    | { times: number; delay?: number }
    | { schedule: Schedule.Schedule<unknown, FetchError> },
): Middleware {
  return (request, next) => {
    const schedule =
      "schedule" in options
        ? options.schedule
        : options.delay != null
          ? Schedule.intersect(Schedule.recurs(options.times), Schedule.spaced(options.delay))
          : Schedule.recurs(options.times)
    return Effect.retry(Effect.suspend(() => next(request)), schedule) as Effect.Effect<
      Entity.Entity<Uint8Array>,
      FetchError
    >
  }
}

export function filterStatus(
  f: (status: number) => boolean,
  options?: { description?: string },
): Middleware {
  return (request, next) =>
    Effect.flatMap(next(request), (entity) => {
      if (f(entity.status!)) {
        return Effect.succeed(entity)
      }
      return Effect.fail(
        new FetchError({
          reason: new StatusError({
            request,
            status: entity.status!,
            description: options?.description,
          }),
        }),
      )
    })
}

export function filterStatusOk(): Middleware {
  return filterStatus((s) => s >= 200 && s < 300)
}

export function followRedirects(options?: { maxRedirects?: number }): Middleware {
  const max = options?.maxRedirects ?? 10
  return (request, next) => {
    const go = (
      req: Request,
      remaining: number,
    ): Effect.Effect<Entity.Entity<Uint8Array>, FetchError> =>
      Effect.flatMap(next(new Request(req, { redirect: "manual" })), (entity) => {
        const status = entity.status!
        if (status < 300 || status >= 400 || remaining <= 0) {
          return Effect.succeed(entity)
        }
        const location = entity.headers["location"]
        if (!location) {
          return Effect.succeed(entity)
        }
        const url = new URL(location, req.url)
        const redirectReq =
          status === 303
            ? new Request(url, { method: "GET", headers: req.headers })
            : new Request(url, req)
        return go(redirectReq, remaining - 1)
      })
    return go(request, max)
  }
}

export function tap(
  f: (entity: Entity.Entity<Uint8Array>) => void | Effect.Effect<void, never, never>,
): Middleware {
  return (request, next) =>
    Effect.tap(next(request), (entity) => {
      const result = f(entity)
      return Effect.isEffect(result) ? result : Effect.void
    })
}
