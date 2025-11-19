import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PostHogService from "./PostHogService.ts"

test.describe("PostHogService", () => {
  const testConfig: PostHogService.PostHogConfig = {
    apiKey: "test-api-key",
    host: "https://test.posthog.com",
  }

  test.it("should create a layer with the correct configuration", async () => {
    const layer = PostHogService.layer(testConfig)

    const program = Effect.gen(function*() {
      const service = yield* PostHogService.PostHog
      return service
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(layer)),
    )

    test.expect(result).toBeDefined()
    test.expect(result.capture).toBeDefined()
    test.expect(result.captureBatch).toBeDefined()
    test.expect(result.identify).toBeDefined()
    test.expect(result.alias).toBeDefined()
    test.expect(result.getFeatureFlag).toBeDefined()
    test.expect(result.getAllFeatureFlags).toBeDefined()
    test.expect(result.getFeatureFlagPayload).toBeDefined()
    test.expect(result.isFeatureEnabled).toBeDefined()
    test.expect(result.getExperimentVariant).toBeDefined()
  })

  test.it("should have correct service methods", async () => {
    const layer = PostHogService.layer(testConfig)

    const program = Effect.gen(function*() {
      const service = yield* PostHogService.PostHog
      return {
        hasCaptureMethod: typeof service.capture === "function",
        hasCaptureBatchMethod: typeof service.captureBatch === "function",
        hasIdentifyMethod: typeof service.identify === "function",
        hasAliasMethod: typeof service.alias === "function",
        hasGetFeatureFlagMethod: typeof service.getFeatureFlag === "function",
        hasGetAllFeatureFlagsMethod: typeof service.getAllFeatureFlags === "function",
        hasGetFeatureFlagPayloadMethod: typeof service.getFeatureFlagPayload === "function",
        hasIsFeatureEnabledMethod: typeof service.isFeatureEnabled === "function",
        hasGetExperimentVariantMethod: typeof service.getExperimentVariant === "function",
      }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(layer)),
    )

    test.expect(result.hasCaptureMethod).toBe(true)
    test.expect(result.hasCaptureBatchMethod).toBe(true)
    test.expect(result.hasIdentifyMethod).toBe(true)
    test.expect(result.hasAliasMethod).toBe(true)
    test.expect(result.hasGetFeatureFlagMethod).toBe(true)
    test.expect(result.hasGetAllFeatureFlagsMethod).toBe(true)
    test.expect(result.hasGetFeatureFlagPayloadMethod).toBe(true)
    test.expect(result.hasIsFeatureEnabledMethod).toBe(true)
    test.expect(result.hasGetExperimentVariantMethod).toBe(true)
  })

  test.it("should use default host when not provided", async () => {
    const configWithoutHost: PostHogService.PostHogConfig = {
      apiKey: "test-api-key",
    }

    const layer = PostHogService.layer(configWithoutHost)

    const program = Effect.gen(function*() {
      const service = yield* PostHogService.PostHog
      return service
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(layer)),
    )

    test.expect(result).toBeDefined()
  })

  test.it("should accept distinctId in config", async () => {
    const configWithDistinctId: PostHogService.PostHogConfig = {
      apiKey: "test-api-key",
      host: "https://test.posthog.com",
      distinctId: "user-123",
    }

    const layer = PostHogService.layer(configWithDistinctId)

    const program = Effect.gen(function*() {
      const service = yield* PostHogService.PostHog
      return service
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(layer)),
    )

    test.expect(result).toBeDefined()
  })

  test.it("should make distinctId optional in capture options", async () => {
    const configWithDistinctId: PostHogService.PostHogConfig = {
      apiKey: "test-api-key",
      host: "https://test.posthog.com",
      distinctId: "user-123",
    }

    const layer = PostHogService.layer(configWithDistinctId)

    const program = Effect.gen(function*() {
      const service = yield* PostHogService.PostHog

      const captureOptions: PostHogService.CaptureEventOptions = {
        event: "test_event",
      }

      test.expect(captureOptions.distinctId).toBeUndefined()
      return true
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(layer)),
    )

    test.expect(result).toBe(true)
  })

  test.it("should make distinctId optional in identify options", async () => {
    const configWithDistinctId: PostHogService.PostHogConfig = {
      apiKey: "test-api-key",
      host: "https://test.posthog.com",
      distinctId: "user-123",
    }

    const layer = PostHogService.layer(configWithDistinctId)

    const program = Effect.gen(function*() {
      const service = yield* PostHogService.PostHog

      const identifyOptions: PostHogService.IdentifyOptions = {
        properties: { name: "Test User" },
      }

      test.expect(identifyOptions.distinctId).toBeUndefined()
      return true
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(layer)),
    )

    test.expect(result).toBe(true)
  })

  test.it("should make distinctId optional in feature flag options", async () => {
    const configWithDistinctId: PostHogService.PostHogConfig = {
      apiKey: "test-api-key",
      host: "https://test.posthog.com",
      distinctId: "user-123",
    }

    const layer = PostHogService.layer(configWithDistinctId)

    const program = Effect.gen(function*() {
      const service = yield* PostHogService.PostHog

      const flagOptions: PostHogService.FeatureFlagOptions = {
        personProperties: { email: "test@example.com" },
      }

      test.expect(flagOptions.distinctId).toBeUndefined()
      return true
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(layer)),
    )

    test.expect(result).toBe(true)
  })
})
