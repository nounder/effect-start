import * as Effect from "effect/Effect"
import type * as Utils from "effect/Utils"
import * as Entity from "./Entity.ts"
import * as Http from "./Http.ts"

export interface FetchError {
  readonly _tag: "FetchError"
  readonly request: Request
  readonly cause: unknown
}

export const FetchError = (request: Request, cause: unknown): FetchError => ({
  _tag: "FetchError",
  request,
  cause,
})

export type FetchEntity = Entity.Entity<Effect.Effect<Uint8Array, FetchError, never>, FetchError>

export type Next = (request: Request) => Effect.Effect<FetchEntity, FetchError>

export type Middleware<E = never, R = never> = (
  request: Request,
  next: Next,
) =>
  | Effect.Effect<FetchEntity, FetchError | E, R>
  | Generator<Utils.YieldWrap<Effect.Effect<unknown, FetchError | E, R>>, FetchEntity, unknown>

export function fromResponse(response: Response, request: Request): FetchEntity {
  return Entity.make(
    Effect.tryPromise({
      try: () => response.arrayBuffer().then((buf) => new Uint8Array(buf)),
      catch: (cause) => FetchError(request, cause),
    }),
    {
      status: response.status,
      headers: Http.mapHeaders(response.headers),
      url: response.url || undefined,
    },
  )
}

function innerFetch(request: Request): Effect.Effect<FetchEntity, FetchError> {
  return Effect.map(
    Effect.tryPromise({
      try: () => globalThis.fetch(request),
      catch: (cause) => FetchError(request, cause),
    }),
    (response) => fromResponse(response, request),
  )
}

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

      return Effect.flatMap(
        Effect.exit(Effect.withParentSpan(effect, span)),
        (exit) => {
          if (exit._tag === "Success") {
            span.attribute("http.response.status_code", exit.value.status ?? 0)
          }
          return exit
        },
      )
    },
  )
}

export function fetch(
  input: string | URL | Request,
  init?: RequestInit,
): Effect.Effect<FetchEntity, FetchError> {
  return Effect.suspend(() => {
    const request = new Request(input, init)
    return withTrace(request, innerFetch(request))
  })
}

function isGenerator(value: unknown): value is Generator {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.iterator in value &&
    typeof (value as Generator).next === "function"
  )
}

type NormalizedMiddleware = (
  request: Request,
  next: Next,
) => Effect.Effect<FetchEntity, any, any>

function normalizeMiddleware<E, R>(mw: Middleware<E, R>): NormalizedMiddleware {
  return (request, next) => {
    const result = mw(request, next)
    if (Effect.isEffect(result)) {
      return result as Effect.Effect<FetchEntity, FetchError | E, R>
    }
    if (isGenerator(result)) {
      return Effect.gen(function* () {
        return yield* result
      }) as Effect.Effect<FetchEntity, FetchError | E, R>
    }
    return Effect.succeed(result as FetchEntity)
  }
}

export interface FetchClient {
  readonly fetch: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Effect.Effect<FetchEntity, any, any>
  readonly use: (...middleware: ReadonlyArray<Middleware<any, any>>) => FetchClient
}

function buildChain(
  stack: ReadonlyArray<NormalizedMiddleware>,
): (request: Request) => Effect.Effect<FetchEntity, any, any> {
  let handler: (req: Request) => Effect.Effect<FetchEntity, any, any> = innerFetch
  for (let i = stack.length - 1; i >= 0; i--) {
    const mw = stack[i]
    const next = handler
    handler = (req) => mw(req, next as Next)
  }
  return handler
}

function createClient(stack: ReadonlyArray<NormalizedMiddleware>): FetchClient {
  const handler = buildChain(stack)

  return {
    fetch: (input, init?) =>
      Effect.suspend(() => {
        const request = new Request(input, init)
        return withTrace(request, handler(request))
      }),
    use: (...middleware) => createClient([...stack, ...middleware.map(normalizeMiddleware)]),
  }
}

export function make(): FetchClient {
  return createClient([])
}
