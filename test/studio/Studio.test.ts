import * as test from "bun:test"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import * as Bundle from "effect-start/bundler/Bundle"
import * as Start from "effect-start/Start"
import * as Studio from "effect-start/studio/Studio"
import * as StudioStore from "effect-start/studio/StudioStore"

const studioLayer = Start.pack(
  Studio.layer(),
  Layer.succeed(Bundle.Bundle, Bundle.emptyBundleContext),
)

test.it("flushes queued telemetry writes when its scope closes", () => {
  let completed = false

  return Effect
    .gen(function*() {
      const studio = yield* Studio.Studio
      StudioStore.runWrite(
        studio.store,
        Effect.andThen(
          Effect.sleep("20 millis"),
          Effect.sync(() => {
            completed = true
          }),
        ),
      )
    })
    .pipe(
      Effect.provide(studioLayer),
      Effect.andThen(Effect.sync(() => {
        test
          .expect(completed)
          .toBe(true)
      })),
      Effect.runPromise,
    )
})

test.it("retains tags and serializable properties for traced failures", () => {
  class StudioTracerTestError extends Data.TaggedError("StudioTracerTestError")<{
    readonly resource: string
    readonly attempt: bigint
  }> {}

  return Effect
    .gen(function*() {
      yield* Effect.fail(new StudioTracerTestError({ resource: "widget", attempt: 2n })).pipe(
        Effect.withSpan("studio.test.failure"),
        Effect.exit,
      )
      yield* StudioStore.flushWrites()

      const sql = yield* SqlClient.SqlClient
      const rows = yield* sql<StudioStore.ErrorRow>`
        SELECT * FROM Error
        WHERE details LIKE ${"%StudioTracerTestError%"}
        ORDER BY rowid DESC
        LIMIT 1
      `
      const detail = StudioStore.deserializeError(rows[0]!).details[0]!

      test
        .expect(detail)
        .toEqual({
          kind: "fail",
          tag: "StudioTracerTestError",
          message: "StudioTracerTestError",
          properties: {
            resource: "widget",
            attempt: "2n",
          },
          span: "studio.test.failure",
        })
    })
    .pipe(
      Effect.provide(studioLayer),
      Effect.runPromise,
    )
})
