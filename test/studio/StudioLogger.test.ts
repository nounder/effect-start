import * as test from "bun:test"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as PubSub from "effect/PubSub"
import * as Queue from "effect/Queue"
import * as Studio from "effect-start/studio/Studio"
import * as StudioLogger from "effect-start/studio/StudioLogger"
import type * as StudioStore from "effect-start/studio/StudioStore"

test.it("preserves application loggers", () =>
  Effect
    .gen(function*() {
      const applicationLogger = Logger.make(() => {})
      const studioLayer = Layer.effect(
        Studio.Studio,
        Effect.gen(function*() {
          return {
            path: "/studio",
            auth: undefined,
            store: {
              events: yield* PubSub.unbounded<StudioStore.StudioEvent>(),
              writes: yield* Queue.unbounded<StudioStore.Write>(),
              spanCapacity: 100,
              logCapacity: 100,
              errorCapacity: 100,
              process: undefined,
            },
          }
        }),
      )
      const context = yield* Layer
        .build(
          StudioLogger.layer.pipe(Layer.provide(studioLayer)),
        )
        .pipe(
          Effect.provide(Logger.layer([applicationLogger])),
          Effect.scoped,
        )

      test
        .expect(Context.get(context, Logger.CurrentLoggers).has(applicationLogger))
        .toBe(true)
    })
    .pipe(Effect.runPromise))
