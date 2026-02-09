import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Schedule from "effect/Schedule"
import * as Entity from "./Entity.ts"

const TypeId: unique symbol = Symbol.for("effect-start/FetchClient")
type TypeId = typeof TypeId

export type FetchEntity = Entity.Entity<Effect.Effect<Uint8Array, FetchError, never>, FetchError>

export class FetchError extends Data.TaggedError("FetchError")<{
  readonly reason: "Network" | "Status"
  readonly cause?: unknown
  readonly request?: Request
  readonly response?: FetchEntity
}> {}

type Next = (request: Request) => Effect.Effect<FetchEntity, FetchError, never>

export type Middleware<E = never, R = never> = (
  request: Request,
  next: Next,
) => Effect.Effect<FetchEntity, FetchError | E, R>

const tryFetch: Middleware = (request) =>
  Effect.map(
    Effect.tryPromise({
      try: () => globalThis.fetch(request),
      catch: (e) => new FetchError({ reason: "Network", cause: e, request }),
    }),
    (response) => Entity.fromResponse(response, request) as FetchEntity,
  )

const defaultMiddleware: ReadonlyArray<Middleware> = [tryFetch]
const noopNext: Next = () => Effect.die("no middleware")

function withTrace<E, R>(
  request: Request,
  effect: Effect.Effect<FetchEntity, E, R>,
): Effect.Effect<FetchEntity, E, R> {
  const url = new URL(request.url)

  return Effect.useSpan(
    `http.client ${request.method}`,
    { kind: "client", captureStackTrace: false },
    (span) => {
      span.attribute("http.request.method", request.method)
      span.attribute("url.full", url.toString())
      span.attribute("url.path", url.pathname)
      const query = url.search.slice(1)
      if (query !== "") {
        span.attribute("url.query", query)
      }
      span.attribute("url.scheme", url.protocol.slice(0, -1))

      return Effect.flatMap(Effect.exit(Effect.withParentSpan(effect, span)), (exit) => {
        if (exit._tag === "Success") {
          span.attribute("http.response.status_code", exit.value.status ?? 0)
        }
        return exit
      })
    },
  )
}

export interface FetchClient<E = never, R = never> {
  readonly [TypeId]: TypeId
  readonly middleware: ReadonlyArray<Middleware<any, any>>
  readonly fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Effect.Effect<FetchEntity, FetchError | E, R>
  readonly get: (
    input: string | URL | Request,
    init?: Omit<RequestInit, "method">,
  ) => Effect.Effect<FetchEntity, FetchError | E, R>
  readonly post: (
    input: string | URL | Request,
    init?: Omit<RequestInit, "method">,
  ) => Effect.Effect<FetchEntity, FetchError | E, R>
  readonly use: <E2, R2>(
    ...middleware: ReadonlyArray<Middleware<E2, R2>>
  ) => FetchClient<E | E2, R | R2>
}

export function fetch(
  input: string | URL | Request,
  init?: RequestInit,
): Effect.Effect<FetchEntity, FetchError>
export function fetch<E, R>(
  this: FetchClient<E, R>,
  input: string | URL | Request,
  init?: RequestInit,
): Effect.Effect<FetchEntity, FetchError | E, R>
export function fetch(
  this: void | FetchClient<any, any>,
  input: string | URL | Request,
  init?: RequestInit,
): Effect.Effect<FetchEntity, any, any> {
  const middleware: ReadonlyArray<Middleware<any, any>> =
    (this as any)?.middleware ?? defaultMiddleware
  return Effect.gen(function* () {
    const request = new Request(input, init)

    let handler: Next = noopNext as Next
    for (let i = middleware.length - 1; i >= 0; i--) {
      const nextHandler = handler
      handler = ((req: Request) => middleware[i](req, nextHandler)) as Next
    }

    return yield* withTrace(request, handler(request))
  }) as any
}

export function get(
  input: string | URL | Request,
  init?: Omit<RequestInit, "method">,
): Effect.Effect<FetchEntity, FetchError>
export function get<E, R>(
  this: FetchClient<E, R>,
  input: string | URL | Request,
  init?: Omit<RequestInit, "method">,
): Effect.Effect<FetchEntity, FetchError | E, R>
export function get(
  this: void | FetchClient<any, any>,
  input: string | URL | Request,
  init?: Omit<RequestInit, "method">,
): Effect.Effect<FetchEntity, any, any> {
  return fetch.call(this as any, input, { ...init, method: "GET" }) as any
}

export function post(
  input: string | URL | Request,
  init?: Omit<RequestInit, "method">,
): Effect.Effect<FetchEntity, FetchError>
export function post<E, R>(
  this: FetchClient<E, R>,
  input: string | URL | Request,
  init?: Omit<RequestInit, "method">,
): Effect.Effect<FetchEntity, FetchError | E, R>
export function post(
  this: void | FetchClient<any, any>,
  input: string | URL | Request,
  init?: Omit<RequestInit, "method">,
): Effect.Effect<FetchEntity, any, any> {
  return fetch.call(this as any, input, { ...init, method: "POST" }) as any
}

export function use<E2, R2>(...middleware: ReadonlyArray<Middleware<E2, R2>>): FetchClient<E2, R2>
export function use<E, R, E2, R2>(
  this: FetchClient<E, R>,
  ...middleware: ReadonlyArray<Middleware<E2, R2>>
): FetchClient<E | E2, R | R2>
export function use(
  this: void | FetchClient<any, any>,
  ...middleware: ReadonlyArray<Middleware<any, any>>
): FetchClient<any, any> {
  const base = (this as any)?.middleware ?? defaultMiddleware
  const transport = base[base.length - 1]
  const existing = base.slice(0, -1)
  return Object.create(ClientProto, {
    middleware: { value: [...existing, ...middleware, transport] },
  }) as FetchClient<any, any>
}

const ClientProto: any = {
  [TypeId]: TypeId,
  middleware: defaultMiddleware,
  fetch,
  get,
  post,
  use,
}

export function filterStatus(
  predicate: (status: number) => boolean,
  options?: {
    readonly orElse?: (entity: FetchEntity) => Effect.Effect<FetchEntity, any, any>
  },
): Middleware<FetchError> {
  return ((_request: Request, next: Next) =>
    Effect.gen(function* () {
      const entity = yield* next(_request)
      const status = entity.status ?? 0
      if (predicate(status)) {
        return entity
      }
      if (options?.orElse) {
        return yield* options.orElse(entity)
      }
      return yield* Effect.fail(new FetchError({ reason: "Status", response: entity }))
    })) as Middleware<FetchError>
}

export function filterStatusOk(options?: {
  readonly orElse?: (entity: FetchEntity) => Effect.Effect<FetchEntity, any, any>
}): Middleware<FetchError> {
  return filterStatus((status) => status >= 200 && status < 300, options)
}

export function followRedirects(options?: { readonly maxRedirects?: number }): Middleware {
  const maxRedirects = options?.maxRedirects ?? 10

  return (request: Request, next: Next) =>
    Effect.gen(function* () {
      let currentRequest = new Request(request.url, {
        ...request,
        redirect: "manual",
      })
      let redirectCount = 0

      while (true) {
        const entity = yield* next(currentRequest)
        const status = entity.status ?? 0

        if (status >= 300 && status < 400) {
          if (redirectCount >= maxRedirects) {
            return entity
          }

          const location = entity.headers["location"]
          if (!location) {
            return entity
          }

          redirectCount++
          const nextUrl = new URL(location, currentRequest.url)

          if (status === 303) {
            currentRequest = new Request(nextUrl.toString(), {
              method: "GET",
              headers: currentRequest.headers,
              redirect: "manual",
            })
          } else {
            currentRequest = new Request(nextUrl.toString(), {
              method: currentRequest.method,
              headers: currentRequest.headers,
              body: currentRequest.body,
              redirect: "manual",
            })
          }
        } else {
          return entity
        }
      }
    })
}

export function retry(options: {
  readonly times?: number
  readonly delay?: number
  readonly schedule?: Schedule.Schedule<any, any, any>
}): Middleware {
  return ((request: Request, next: Next) => {
    if (options.schedule) {
      return Effect.retry(
        Effect.suspend(() => next(request)),
        options.schedule,
      )
    }

    const times = options.times ?? 3
    const delay = options.delay ?? 1000

    return Effect.retry(
      Effect.suspend(() => next(request)),
      Schedule.intersect(Schedule.recurs(times), Schedule.exponential(delay)),
    )
  }) as Middleware
}
