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

export function fromResponse(
  response: Response,
  request: Request,
): FetchEntity {
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

function baseFetch(request: Request): Effect.Effect<FetchEntity, FetchError> {
  return Effect.map(
    Effect.tryPromise({
      try: () => globalThis.fetch(request),
      catch: (cause) => FetchError(request, cause),
    }),
    (response) => fromResponse(response, request),
  )
}

export function fetch(
  input: string | URL | Request,
  init?: RequestInit,
): Effect.Effect<FetchEntity, FetchError> {
  return Effect.suspend(() => baseFetch(new Request(input, init)))
}

function isGenerator(value: unknown): value is Generator {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.iterator in value &&
    typeof (value as Generator).next === "function"
  )
}

function normalizeMiddleware<E, R>(
  mw: Middleware<E, R>,
): (request: Request, next: Next) => Effect.Effect<FetchEntity, FetchError | E, R> {
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

export function make(
  ...middleware: ReadonlyArray<Middleware<any, any>>
): (input: string | URL | Request, init?: RequestInit) => Effect.Effect<FetchEntity, any, any> {
  const normalized = middleware.map(normalizeMiddleware)

  return (input, init?) =>
    Effect.suspend(() => {
      const request = new Request(input, init)

      let handler: (req: Request) => Effect.Effect<FetchEntity, any, any> = baseFetch
      for (let i = normalized.length - 1; i >= 0; i--) {
        const mw = normalized[i]
        const next = handler
        handler = (req) => mw(req, next as Next)
      }

      return handler(request)
    })
}
