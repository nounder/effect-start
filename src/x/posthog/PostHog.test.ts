import * as HttpApp from "@effect/platform/HttpApp"
import * as HttpRouter from "@effect/platform/HttpRouter"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as HttpServerResponse from "@effect/platform/HttpServerResponse"
import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as TestHttpClient from "../../TestHttpClient.ts"
import * as PostHog from "./PostHog.ts"

test.describe("PostHog", () => {
  test.describe("layer", () => {
    test.it("should create a PostHog service", async () => {
      const program = Effect.gen(function*() {
        const posthog = yield* PostHog.PostHog

        test.expect(posthog).toBeDefined()
        test.expect(posthog.captureEvent).toBeDefined()
        test.expect(posthog.identify).toBeDefined()
        test.expect(posthog.alias).toBeDefined()
        test.expect(posthog.isFeatureEnabled).toBeDefined()
        test.expect(posthog.getFeatureFlag).toBeDefined()
        test.expect(posthog.getAllFlags).toBeDefined()
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(PostHog.layer({
            apiKey: "test-api-key",
          })),
        ),
      )
    })

    test.it("should capture events (disabled layer)", async () => {
      const program = Effect.gen(function*() {
        const posthog = yield* PostHog.PostHog

        yield* posthog.captureEvent("test_event", "user-123", {
          property1: "value1",
        })
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(PostHog.layerDisabled()),
        ),
      )
    })

    test.it("should identify users (disabled layer)", async () => {
      const program = Effect.gen(function*() {
        const posthog = yield* PostHog.PostHog

        yield* posthog.identify("user-123", {
          email: "user@example.com",
          name: "Test User",
        })
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(PostHog.layerDisabled()),
        ),
      )
    })

    test.it("should alias users (disabled layer)", async () => {
      const program = Effect.gen(function*() {
        const posthog = yield* PostHog.PostHog

        yield* posthog.alias("new-user-id", "old-user-id")
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(PostHog.layerDisabled()),
        ),
      )
    })

    test.it("should check feature flags (disabled layer)", async () => {
      const program = Effect.gen(function*() {
        const posthog = yield* PostHog.PostHog

        const isEnabled = yield* posthog.isFeatureEnabled(
          "test-feature",
          "user-123",
        )

        test.expect(isEnabled).toBe(false)
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(PostHog.layerDisabled()),
        ),
      )
    })

    test.it("should get feature flag values (disabled layer)", async () => {
      const program = Effect.gen(function*() {
        const posthog = yield* PostHog.PostHog

        const flagValue = yield* posthog.getFeatureFlag(
          "test-feature",
          "user-123",
        )

        test.expect(Option.isNone(flagValue)).toBe(true)
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(PostHog.layerDisabled()),
        ),
      )
    })

    test.it("should get all flags (disabled layer)", async () => {
      const program = Effect.gen(function*() {
        const posthog = yield* PostHog.PostHog

        const allFlags = yield* posthog.getAllFlags("user-123")

        test.expect(allFlags).toEqual({})
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(PostHog.layerDisabled()),
        ),
      )
    })
  })

  test.describe("layerDisabled", () => {
    test.it("should create a disabled PostHog service", async () => {
      const program = Effect.gen(function*() {
        const posthog = yield* PostHog.PostHog

        yield* posthog.captureEvent("test_event", "user-123")
        yield* posthog.identify("user-123")
        const isEnabled = yield* posthog.isFeatureEnabled(
          "test-feature",
          "user-123",
        )

        test.expect(isEnabled).toBe(false)
      })

      await Effect.runPromise(
        program.pipe(
          Effect.provide(PostHog.layerDisabled()),
        ),
      )
    })
  })

  test.describe("middleware", () => {
    test.it("should create middleware", () => {
      const mw = PostHog.middleware()
      test.expect(mw).toBeDefined()
    })

    test.it("should create middleware with config", () => {
      const mw = PostHog.middleware({
        extractDistinctId: () => Effect.succeed(Option.some("user-123")),
        capturePageView: true,
        captureApiCalls: true,
      })
      test.expect(mw).toBeDefined()
    })
  })
})
