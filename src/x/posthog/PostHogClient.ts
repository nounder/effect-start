import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type * as PostHogService from "./PostHogService.ts"
import * as PostHogError from "./PostHogError.ts"

const DEFAULT_HOST = "https://us.i.posthog.com"

interface PostHogClientConfig {
  readonly apiKey: string
  readonly host: string
  readonly personalApiKey?: string
  readonly distinctId?: string
}

interface CapturePayload {
  readonly api_key: string
  readonly event: string
  readonly distinct_id: string
  readonly properties?: Record<string, unknown>
  readonly timestamp?: string
}

interface BatchPayload {
  readonly api_key: string
  readonly batch: ReadonlyArray<{
    readonly event: string
    readonly distinct_id: string
    readonly properties?: Record<string, unknown>
    readonly timestamp?: string
  }>
}

interface FeatureFlagsPayload {
  readonly api_key: string
  readonly distinct_id: string
  readonly person_properties?: Record<string, unknown>
  readonly group_properties?: Record<string, unknown>
  readonly groups?: Record<string, string>
}

const FeatureFlagsResponseSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Union(Schema.Boolean, Schema.String, Schema.Undefined),
})

const FeatureFlagPayloadResponseSchema = Schema.Unknown

function makeRequest<A, I = unknown, R = never>(
  url: string,
  options: RequestInit,
  schema?: Schema.Schema<A, I, R>,
): Effect.Effect<A, PostHogError.PostHogError, R> {
  return Effect.gen(function*() {
    const response = yield* Effect.tryPromise({
      try: () => fetch(url, options),
      catch: (error) =>
        new PostHogError.PostHogNetworkError({
          reason: "Failed to make request to PostHog API",
          cause: error,
        }),
    })

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After")
      return yield* Effect.fail(
        new PostHogError.PostHogRateLimitError({
          reason: "Rate limit exceeded",
          retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
        }),
      )
    }

    if (!response.ok) {
      const text = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (error) =>
          new PostHogError.PostHogInvalidResponseError({
            reason: "Unable to read response body",
            cause: error,
          }),
      })

      return yield* Effect.fail(
        new PostHogError.PostHogNetworkError({
          reason: `PostHog API returned status ${response.status}`,
          statusCode: response.status,
          cause: text,
        }),
      )
    }

    if (!schema) {
      return undefined as A
    }

    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (error) =>
        new PostHogError.PostHogInvalidResponseError({
          reason: "Failed to parse JSON response",
          cause: error,
        }),
    })

    return yield* Schema.decodeUnknown(schema)(json).pipe(
      Effect.mapError((error) =>
        new PostHogError.PostHogInvalidResponseError({
          reason: "Invalid response format from PostHog API",
          cause: error,
          response: json,
        })
      ),
    )
  })
}

export function createClient(config: PostHogClientConfig): PostHogService.PostHogService {
  const host = config.host || DEFAULT_HOST

  function getDistinctId(provided?: string): Effect.Effect<string, PostHogError.PostHogConfigError> {
    const distinctId = provided || config.distinctId

    if (!distinctId) {
      return Effect.fail(
        new PostHogError.PostHogConfigError({
          reason: "distinctId is required but was not provided in options or config",
        }),
      )
    }

    return Effect.succeed(distinctId)
  }

  const client: PostHogService.PostHogService = {
    capture: (options) =>
      Effect.gen(function*() {
        const distinctId = yield* getDistinctId(options.distinctId)

        const payload: CapturePayload = {
          api_key: config.apiKey,
          event: options.event,
          distinct_id: distinctId,
          properties: options.properties as Record<string, unknown> | undefined,
          timestamp: options.timestamp,
        }

        yield* makeRequest(
          `${host}/i/v0/e/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        )
      }),

    captureBatch: (options) =>
      Effect.gen(function*() {
        const batchWithDistinctIds = yield* Effect.all(
          options.events.map((event) =>
            Effect.gen(function*() {
              const distinctId = yield* getDistinctId(event.distinctId)
              return {
                event: event.event,
                distinct_id: distinctId,
                properties: event.properties as Record<string, unknown> | undefined,
                timestamp: event.timestamp,
              }
            })
          ),
        )

        const payload: BatchPayload = {
          api_key: config.apiKey,
          batch: batchWithDistinctIds,
        }

        yield* makeRequest(
          `${host}/batch/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        )
      }),

    identify: (options) =>
      Effect.gen(function*() {
        const distinctId = yield* getDistinctId(options.distinctId)

        const payload: CapturePayload = {
          api_key: config.apiKey,
          event: "$identify",
          distinct_id: distinctId,
          properties: {
            $set: options.properties,
          },
        }

        yield* makeRequest(
          `${host}/i/v0/e/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        )
      }),

    alias: (options) =>
      Effect.gen(function*() {
        const distinctId = yield* getDistinctId(options.distinctId)

        const payload: CapturePayload = {
          api_key: config.apiKey,
          event: "$create_alias",
          distinct_id: distinctId,
          properties: {
            distinct_id: distinctId,
            alias: options.alias,
          },
        }

        yield* makeRequest(
          `${host}/i/v0/e/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        )
      }),

    getAllFeatureFlags: (options) =>
      Effect.gen(function*() {
        const distinctId = yield* getDistinctId(options.distinctId)

        const payload: FeatureFlagsPayload = {
          api_key: config.apiKey,
          distinct_id: distinctId,
          person_properties: options.personProperties as Record<string, unknown> | undefined,
          group_properties: options.groupProperties as Record<string, unknown> | undefined,
          groups: options.groups,
        }

        const response = yield* makeRequest(
          `${host}/decide/?v=3`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
          Schema.Struct({
            featureFlags: FeatureFlagsResponseSchema,
          }),
        )

        return response.featureFlags
      }),

    getFeatureFlag: (flagKey, options) =>
      Effect.gen(function*() {
        const flags = yield* client.getAllFeatureFlags(options)
        return flags[flagKey]
      }),

    isFeatureEnabled: (flagKey, options) =>
      Effect.gen(function*() {
        const value = yield* client.getFeatureFlag(flagKey, options)
        return value === true
      }),

    getFeatureFlagPayload: (flagKey, options) =>
      Effect.gen(function*() {
        const distinctId = yield* getDistinctId(options.distinctId)

        const payload: FeatureFlagsPayload = {
          api_key: config.apiKey,
          distinct_id: distinctId,
          person_properties: options.personProperties as Record<string, unknown> | undefined,
          group_properties: options.groupProperties as Record<string, unknown> | undefined,
          groups: options.groups,
        }

        const response = yield* makeRequest(
          `${host}/decide/?v=3`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
          Schema.Struct({
            featureFlagPayloads: Schema.optional(Schema.Record({
              key: Schema.String,
              value: FeatureFlagPayloadResponseSchema,
            })),
          }),
        )

        return response.featureFlagPayloads?.[flagKey]
      }),

    getExperimentVariant: (options) =>
      Effect.gen(function*() {
        const flags = yield* client.getAllFeatureFlags({
          distinctId: options.distinctId,
          personProperties: options.personProperties,
          groupProperties: options.groupProperties,
        })

        const variant = flags[options.experimentKey]

        if (variant === undefined) {
          return yield* Effect.fail(
            new PostHogError.PostHogInvalidResponseError({
              reason: `Experiment '${options.experimentKey}' not found`,
            }),
          )
        }

        const payload = yield* client.getFeatureFlagPayload(
          options.experimentKey,
          {
            distinctId: options.distinctId,
            personProperties: options.personProperties,
            groupProperties: options.groupProperties,
          },
        )

        return {
          variant,
          payload,
        }
      }),
  }

  return client
}
