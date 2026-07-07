import * as test from "bun:test"
import * as Effect from "effect/Effect"
import type * as Tracing from "../../src/internal/Tracing.ts"
import * as BunSql from "../../src/sql/bun/index.ts"
import * as StudioStore from "../../src/studio/StudioStore.ts"

let nextId = 1n

function makeSpan(status: Tracing.Span["status"]): Tracing.Span {
  const spanId = (nextId++).toString()
  return {
    spanId,
    traceId: spanId,
    fiberId: undefined,
    name: "test",
    kind: "internal",
    parentSpanId: undefined,
    startTime: 0n,
    endTime: status === "started" ? undefined : 1n,
    durationMs: status === "started" ? undefined : 0,
    status,
    attributes: {},
    events: [],
  }
}

test.it("evictSpans keeps spans that have not ended yet", () =>
  Effect
    .gen(function*() {
      yield* StudioStore.setupDatabase

      const openSpan = makeSpan("started")
      yield* StudioStore.insertSpan(openSpan)
      for (let i = 0; i < 5; i++) {
        yield* StudioStore.insertSpan(makeSpan("ok"))
      }

      yield* StudioStore.evictSpans(3)

      const spans = yield* StudioStore.allSpans()

      test
        .expect(spans.map((span) => span.spanId))
        .toContain(openSpan.spanId)
      test
        .expect(spans.filter((span) => span.status === "ok"))
        .toHaveLength(3)

      const endedSpan: Tracing.Span = {
        ...openSpan,
        endTime: 2n,
        durationMs: 2,
        status: "ok",
      }
      yield* StudioStore.updateSpan(endedSpan)
      yield* StudioStore.evictSpans(3)

      const spansAfterEnd = yield* StudioStore.allSpans()

      test
        .expect(spansAfterEnd.map((span) => span.spanId))
        .not
        .toContain(openSpan.spanId)
    })
    .pipe(
      Effect.provide(BunSql.layer({ adapter: "sqlite", filename: ":memory:" })),
      Effect.runPromise,
    ))
