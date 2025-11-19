import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as PostHogError from "./PostHogError.ts"
import * as PostHogClient from "./PostHogClient.ts"

export interface PostHogConfig {
  readonly apiKey: string
  readonly host?: string
  readonly personalApiKey?: string
  readonly distinctId?: string
}

export interface EventProperties {
  readonly [key: string]: unknown
}

export interface PersonProperties {
  readonly [key: string]: unknown
}

export interface GroupProperties {
  readonly [key: string]: unknown
}

export interface CaptureEventOptions {
  readonly event: string
  readonly distinctId?: string
  readonly properties?: EventProperties
  readonly timestamp?: string
}

export interface CaptureEventsOptions {
  readonly events: ReadonlyArray<CaptureEventOptions>
}

export interface IdentifyOptions {
  readonly distinctId?: string
  readonly properties: PersonProperties
}

export interface AliasOptions {
  readonly distinctId?: string
  readonly alias: string
}

export interface FeatureFlagOptions {
  readonly distinctId?: string
  readonly personProperties?: PersonProperties
  readonly groupProperties?: GroupProperties
  readonly groups?: Record<string, string>
}

export interface FeatureFlagResult {
  readonly [flagKey: string]: boolean | string | undefined
}

export interface FeatureFlagPayload {
  readonly [flagKey: string]: unknown
}

export interface ExperimentOptions {
  readonly distinctId?: string
  readonly experimentKey: string
  readonly personProperties?: PersonProperties
  readonly groupProperties?: GroupProperties
}

export interface ExperimentResult {
  readonly variant: string | boolean
  readonly payload?: unknown
}

export interface PostHogService {
  readonly capture: (
    options: CaptureEventOptions,
  ) => Effect.Effect<void, PostHogError.PostHogError>

  readonly captureBatch: (
    options: CaptureEventsOptions,
  ) => Effect.Effect<void, PostHogError.PostHogError>

  readonly identify: (
    options: IdentifyOptions,
  ) => Effect.Effect<void, PostHogError.PostHogError>

  readonly alias: (
    options: AliasOptions,
  ) => Effect.Effect<void, PostHogError.PostHogError>

  readonly getFeatureFlag: (
    flagKey: string,
    options: FeatureFlagOptions,
  ) => Effect.Effect<boolean | string | undefined, PostHogError.PostHogError>

  readonly getAllFeatureFlags: (
    options: FeatureFlagOptions,
  ) => Effect.Effect<FeatureFlagResult, PostHogError.PostHogError>

  readonly getFeatureFlagPayload: (
    flagKey: string,
    options: FeatureFlagOptions,
  ) => Effect.Effect<unknown, PostHogError.PostHogError>

  readonly isFeatureEnabled: (
    flagKey: string,
    options: FeatureFlagOptions,
  ) => Effect.Effect<boolean, PostHogError.PostHogError>

  readonly getExperimentVariant: (
    options: ExperimentOptions,
  ) => Effect.Effect<ExperimentResult, PostHogError.PostHogError>
}

export class PostHog extends Context.Tag("effect-start/PostHog")<
  PostHog,
  PostHogService
>() {}

export function layer(config: PostHogConfig): Layer.Layer<PostHog> {
  return Layer.sync(PostHog, () =>
    PostHogClient.createClient({
      apiKey: config.apiKey,
      host: config.host || "https://us.i.posthog.com",
      personalApiKey: config.personalApiKey,
      distinctId: config.distinctId,
    })
  )
}
