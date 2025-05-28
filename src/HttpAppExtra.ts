import {
  HttpApp,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import {
  Array,
  Cause,
  Effect,
  Match,
  pipe,
  Predicate,
} from "effect"

/**
 * Sequentially call provided HttpApps until first non-404 response
 * is called.
 */
export const chain = <
  A extends HttpApp.Default<any | RouteNotFound, any>,
  L extends A[],
>(
  apps: L,
): HttpApp.Default<
  L[number] extends HttpApp.Default<infer E, any> ? Exclude<E, RouteNotFound>
    : never,
  L[number] extends HttpApp.Default<any, infer R> ? R : never
> =>
  pipe(
    apps,
    Array.map((app: A) =>
      pipe(
        app,
        Effect.catchTag(
          "RouteNotFound",
          () => HttpServerResponse.empty({ status: 404 }),
        ),
      )
    ),
    apps =>
      Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest
        let lastResponse: HttpServerResponse.HttpServerResponse | undefined

        for (const app of apps) {
          const res = yield* app
          lastResponse = res

          if (res.status !== 404) {
            return res
          }
        }

        if (lastResponse) {
          return lastResponse
        }

        return yield* HttpServerResponse.empty({ status: 404 })
      }),
  )

/**
 * Groups: function, path
 */
const StackLinePattern = /^at (.*?) \((.*?)\)/

export const renderError = (
  e: RouteNotFound | Cause.Cause<unknown>,
) =>
  Effect.gen(function*() {
    if (process.env.NODE_ENV !== "test") {
      yield* Effect.logError(e)
    }

    return yield* pipe(
      Match.value(e),
      Match.when(
        Predicate.isTagged("RouteNotFound"),
        (_) =>
          HttpServerResponse.unsafeJson(
            {
              error: "RouteNotFound",
            },
            {
              status: 404,
            },
          ),
      ),
      Match.when(
        Predicate.or(
          Predicate.isTagged("Die"),
          Predicate.isTagged("Fail"),
        ),
        (e) =>
          HttpServerResponse.unsafeJson(
            {
              error: e["defect"]?.name,
              message: e["defect"]?.message,
            },
            {
              status: 500,
            },
          ),
      ),
      Match.orElse(() =>
        HttpServerResponse.unsafeJson(
          {
            error: "Unexpected",
          },
          {
            status: 500,
          },
        )
      ),
    )
  })

function extractPrettyStack(stack: string) {
  return stack
    .split("\n")
    .slice(1)
    .map((line) => {
      const match = line.trim().match(StackLinePattern)

      if (!match) return line

      const [_, fn, path] = match
      const relativePath = path.replace(process.cwd(), ".")
      return [fn, relativePath]
    })
    .filter(Boolean)
}
