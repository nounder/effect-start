import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpMiddleware from "@effect/platform/HttpMiddleware"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"

export class PostHogError extends Data.TaggedError("PostHogError")<{
  cause: unknown
  operation: string
}> {}

export type EventProperties = Record<string, unknown>

export type UserProperties = Record<string, unknown>

export type FeatureFlagPayload = Record<string, unknown>

export interface PostHogService {
  readonly captureEvent: (
    event: string,
    distinctId: string,
    properties?: EventProperties,
  ) => Effect.Effect<void, PostHogError>

  readonly identify: (
    distinctId: string,
    properties?: UserProperties,
  ) => Effect.Effect<void, PostHogError>

  readonly alias: (
    alias: string,
    distinctId: string,
  ) => Effect.Effect<void, PostHogError>

  readonly isFeatureEnabled: (
    key: string,
    distinctId: string,
    options?: {
      properties?: UserProperties
      groups?: Record<string, string>
    },
  ) => Effect.Effect<boolean, PostHogError>

  readonly getFeatureFlag: (
    key: string,
    distinctId: string,
    options?: {
      properties?: UserProperties
      groups?: Record<string, string>
    },
  ) => Effect.Effect<string | boolean | Option.Option<never>, PostHogError>

  readonly getFeatureFlagPayload: (
    key: string,
    distinctId: string,
    matchValue?: string | boolean,
  ) => Effect.Effect<Option.Option<FeatureFlagPayload>, PostHogError>

  readonly getAllFlags: (
    distinctId: string,
    options?: {
      properties?: UserProperties
      groups?: Record<string, string>
    },
  ) => Effect.Effect<Record<string, string | boolean>, PostHogError>

  readonly reloadFeatureFlags: () => Effect.Effect<void, PostHogError>

  readonly shutdown: () => Effect.Effect<void, PostHogError>
}

export class PostHog extends Context.Tag("effect-start/PostHog")<
  PostHog,
  PostHogService
>() {}

export interface PostHogConfig {
  readonly apiKey: string
  readonly host?: string
  readonly flushAt?: number
  readonly flushInterval?: number
  readonly personalApiKey?: string
  readonly featureFlagsPollingInterval?: number
  readonly requestTimeout?: number
  readonly disabled?: boolean
}

export function layer(config: PostHogConfig): Layer.Layer<PostHog, never> {
  return Layer.effect(
    PostHog,
    Effect.gen(function*() {
      const host = config.host ?? "https://us.i.posthog.com"
      const timeout = config.requestTimeout ?? 10000

      const captureEndpoint = `${host}/batch/`
      const featureFlagsEndpoint = `${host}/decide/?v=2`

      let flagsCache: Record<string, FlagDecisionResponse> = {}

      const makeRequest = <T>(
        url: string,
        body: unknown,
      ): Effect.Effect<T, PostHogError> =>
        Effect.tryPromise({
          try: async () => {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), timeout)

            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
              signal: controller.signal,
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
              const text = await response.text()
              throw new Error(
                `PostHog API error: ${response.status} ${response.statusText} - ${text}`,
              )
            }

            const data = await response.json()
            return data as T
          },
          catch: (error) =>
            new PostHogError({
              cause: error,
              operation: "makeRequest",
            }),
        })

      return {
        captureEvent: (event, distinctId, properties = {}) =>
          Effect.gen(function*() {
            yield* makeRequest<{ status: number }>(captureEndpoint, {
              api_key: config.apiKey,
              batch: [
                {
                  event,
                  distinct_id: distinctId,
                  properties: {
                    ...properties,
                    distinct_id: distinctId,
                  },
                  timestamp: new Date().toISOString(),
                },
              ],
            })
          }),

        identify: (distinctId, properties = {}) =>
          Effect.gen(function*() {
            yield* makeRequest<{ status: number }>(captureEndpoint, {
              api_key: config.apiKey,
              batch: [
                {
                  event: "$identify",
                  distinct_id: distinctId,
                  properties: {
                    distinct_id: distinctId,
                    $set: properties,
                  },
                  timestamp: new Date().toISOString(),
                },
              ],
            })
          }),

        alias: (alias, distinctId) =>
          Effect.gen(function*() {
            yield* makeRequest<{ status: number }>(captureEndpoint, {
              api_key: config.apiKey,
              batch: [
                {
                  event: "$create_alias",
                  distinct_id: distinctId,
                  properties: {
                    distinct_id: distinctId,
                    alias,
                  },
                  timestamp: new Date().toISOString(),
                },
              ],
            })
          }),

        isFeatureEnabled: (key, distinctId, options = {}) =>
          Effect.gen(function*() {
            const response = yield* makeRequest<DecideResponse>(
              featureFlagsEndpoint,
              {
                api_key: config.apiKey,
                distinct_id: distinctId,
                groups: options.groups,
                person_properties: options.properties,
              },
            )

            if (response.errorsWhileComputingFlags) {
              return yield* Effect.fail(
                new PostHogError({
                  cause: "Errors while computing flags",
                  operation: "isFeatureEnabled",
                }),
              )
            }

            const flag = response.featureFlags?.[key]
            if (!flag) {
              return false
            }

            flagsCache[key] = flag

            return flag.enabled ?? false
          }),

        getFeatureFlag: (key, distinctId, options = {}) =>
          Effect.gen(function*() {
            const response = yield* makeRequest<DecideResponse>(
              featureFlagsEndpoint,
              {
                api_key: config.apiKey,
                distinct_id: distinctId,
                groups: options.groups,
                person_properties: options.properties,
              },
            )

            if (response.errorsWhileComputingFlags) {
              return yield* Effect.fail(
                new PostHogError({
                  cause: "Errors while computing flags",
                  operation: "getFeatureFlag",
                }),
              )
            }

            const flag = response.featureFlags?.[key]
            if (!flag) {
              return Option.none()
            }

            flagsCache[key] = flag

            if (flag.variant !== undefined) {
              return flag.variant
            }

            return flag.enabled ?? false
          }),

        getFeatureFlagPayload: (key, distinctId, matchValue) =>
          Effect.gen(function*() {
            const cached = flagsCache[key]
            if (cached?.metadata?.payload) {
              return yield* Effect.try({
                try: () =>
                  Option.some(JSON.parse(cached.metadata.payload as string)),
                catch: () => Option.none(),
              })
            }

            return Option.none()
          }),

        getAllFlags: (distinctId, options = {}) =>
          Effect.gen(function*() {
            const response = yield* makeRequest<DecideResponse>(
              featureFlagsEndpoint,
              {
                api_key: config.apiKey,
                distinct_id: distinctId,
                groups: options.groups,
                person_properties: options.properties,
              },
            )

            if (response.errorsWhileComputingFlags) {
              return yield* Effect.fail(
                new PostHogError({
                  cause: "Errors while computing flags",
                  operation: "getAllFlags",
                }),
              )
            }

            const flags: Record<string, string | boolean> = {}

            if (response.featureFlags) {
              for (const [key, flag] of Object.entries(response.featureFlags)) {
                flagsCache[key] = flag
                flags[key] = flag.variant ?? flag.enabled ?? false
              }
            }

            return flags
          }),

        reloadFeatureFlags: () => Effect.void,

        shutdown: () => Effect.void,
      }
    }),
  )
}

interface FlagDecisionResponse {
  enabled?: boolean
  variant?: string
  reason?: {
    code: string
    condition_index?: number
    description?: string
  }
  metadata?: {
    id?: number
    version?: number
    payload?: string | Record<string, unknown>
  }
}

interface DecideResponse {
  featureFlags?: Record<string, FlagDecisionResponse>
  errorsWhileComputingFlags?: boolean
  requestId?: string
}

export function layerDisabled(): Layer.Layer<PostHog, never> {
  return Layer.succeed(
    PostHog,
    {
      captureEvent: () => Effect.void,
      identify: () => Effect.void,
      alias: () => Effect.void,
      isFeatureEnabled: () => Effect.succeed(false),
      getFeatureFlag: () => Effect.succeed(Option.none()),
      getFeatureFlagPayload: () => Effect.succeed(Option.none()),
      getAllFlags: () => Effect.succeed({}),
      reloadFeatureFlags: () => Effect.void,
      shutdown: () => Effect.void,
    },
  )
}

export interface PostHogMiddlewareConfig {
  readonly extractDistinctId?: (
    request: HttpServerRequest.HttpServerRequest,
  ) => Effect.Effect<Option.Option<string>, never>
  readonly capturePageView?: boolean
  readonly captureApiCalls?: boolean
}

export function middleware(
  config?: PostHogMiddlewareConfig,
): HttpMiddleware.HttpMiddleware {
  return HttpMiddleware.make((app) =>
    Effect.gen(function*() {
      const posthog = yield* PostHog
      const request = yield* HttpServerRequest.HttpServerRequest

      const extractDistinctId = config?.extractDistinctId ??
        (() => Effect.succeed(Option.none()))

      const distinctIdOption = yield* extractDistinctId(request)

      if (Option.isSome(distinctIdOption)) {
        const distinctId = distinctIdOption.value

        if (config?.capturePageView && request.method === "GET") {
          yield* Effect.forkDaemon(
            posthog.captureEvent("$pageview", distinctId, {
              $current_url: request.url,
              $pathname: new URL(request.url).pathname,
            }).pipe(
              Effect.catchAll(() => Effect.void),
            ),
          )
        }

        if (config?.captureApiCalls) {
          yield* Effect.forkDaemon(
            posthog.captureEvent("api_call", distinctId, {
              method: request.method,
              path: new URL(request.url).pathname,
              url: request.url,
            }).pipe(
              Effect.catchAll(() => Effect.void),
            ),
          )
        }
      }

      return yield* app
    }),
  )
}
