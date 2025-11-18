import * as Data from "effect/Data"

export class PostHogNetworkError extends Data.TaggedError("PostHogNetworkError")<{
  readonly reason: string
  readonly cause?: unknown
  readonly statusCode?: number
}> {}

export class PostHogInvalidResponseError extends Data.TaggedError("PostHogInvalidResponseError")<{
  readonly reason: string
  readonly cause?: unknown
  readonly response?: unknown
}> {}

export class PostHogConfigError extends Data.TaggedError("PostHogConfigError")<{
  readonly reason: string
}> {}

export class PostHogRateLimitError extends Data.TaggedError("PostHogRateLimitError")<{
  readonly reason: string
  readonly retryAfter?: number
}> {}

export type PostHogError =
  | PostHogNetworkError
  | PostHogInvalidResponseError
  | PostHogConfigError
  | PostHogRateLimitError
