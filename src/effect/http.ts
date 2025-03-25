import { Error, HttpServerResponse } from "@effect/platform"
import { RouteNotFound } from "@effect/platform/HttpServerError"
import {
  Cause,
  Config,
  Console,
  Data,
  Effect,
  HashMap,
  Logger,
  Match,
  pipe,
  Predicate,
} from "effect"
import { TaggedError } from "effect/Data"

/**
 * Groups: function, path
 */
const StackLinePattern = /^at (.*?) \((.*?)\)/

export const handleHttpServerResponseError = (
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
        () =>
          HttpServerResponse.json(
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
          HttpServerResponse.json(
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
        HttpServerResponse.json(
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
