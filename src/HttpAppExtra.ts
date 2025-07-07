import {
  HttpRouter,
  HttpServerResponse,
} from "@effect/platform"
import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import {
  RequestError,
  RouteNotFound,
} from "@effect/platform/HttpServerError"
import {
  Cause,
  Effect,
  Option,
  ParseResult,
  Record,
} from "effect"

/**
 * Groups: function, path
 */
const StackLinePattern = /^at (.*?) \((.*?)\)/

type GraciousError =
  | RouteNotFound
  | ParseResult.ParseError
  | RequestError
  | ParseResult.ParseError

export const renderError = (
  error: unknown,
) =>
  Effect.gen(function*() {
    let unwrappedError: GraciousError | undefined

    if (Cause.isCause(error)) {
      const failure = Cause.failureOption(error).pipe(Option.getOrUndefined)

      if (failure?.["_tag"]) {
        unwrappedError = failure as GraciousError
      }

      yield* Effect.logError(error)
    }

    switch (unwrappedError?._tag) {
      case "RouteNotFound":
        return yield* HttpServerResponse.unsafeJson({
          error: {
            _tag: unwrappedError._tag,
          },
        }, {
          status: 404,
        })
      case "RequestError": {
        const message = unwrappedError.reason === "Decode"
          ? "Request body is invalid"
          : undefined

        return yield* HttpServerResponse.unsafeJson({
          error: {
            _tag: unwrappedError._tag,
            reason: unwrappedError.reason,
            message,
          },
        }, {
          status: 400,
        })
      }
      case "ParseError": {
        const issues = yield* ParseResult.ArrayFormatter.formatIssue(
          unwrappedError.issue,
        )
        const cleanIssues = issues.map(v => Record.remove(v, "_tag"))

        return yield* HttpServerResponse.unsafeJson({
          error: {
            _tag: unwrappedError._tag,
            issues: cleanIssues,
          },
        }, {
          status: 400,
        })
      }
    }

    return yield* HttpServerResponse.unsafeJson({
      error: {
        _tag: "UnexpectedError",
      },
    }, {
      status: 500,
    })
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

export function handleErrors<
  E,
  R,
>(
  app: HttpApp.Default<E, R>,
): HttpApp.Default<Exclude<E, RouteNotFound>, R> {
  return app.pipe(
    Effect.catchAllCause(renderError),
  )
}

export const withErrorHandled = HttpMiddleware.make(app => {
  return app.pipe(
    Effect.catchAllCause(renderError),
  )
})
