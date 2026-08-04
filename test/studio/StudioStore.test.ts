import * as test from "bun:test"
import * as Effect from "effect/Effect"
import type * as Tracing from "../../src/internal/Tracing.ts"
import * as BunSql from "../../src/sql/bun/index.ts"
import * as SqlClient from "../../src/sql/SqlClient.ts"
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

test.it("round-trips compact OTLP IDs and telemetry metadata", () =>
  Effect
    .gen(function*() {
      yield* StudioStore.setupDatabase
      const span: Tracing.Span = {
        ...makeSpan("ok"),
        spanId: "0123456789abcdef",
        traceId: "0123456789abcdef0123456789abcdef",
        parentSpanId: "fedcba9876543210",
        resource: {
          attributes: { "service.name": "api" },
          droppedAttributesCount: 1,
          schemaUrl: "https://example.com/resource",
        },
        instrumentationScope: {
          name: "example",
          version: "1.0.0",
          attributes: { source: "test" },
          droppedAttributesCount: 2,
          schemaUrl: "https://example.com/scope",
        },
      }
      yield* StudioStore.insertSpan(span)
      const effectSpan = makeSpan("ok")
      yield* StudioStore.insertSpan(effectSpan)

      const spans = yield* StudioStore.spansByTraceId(span.traceId)

      test
        .expect(spans)
        .toEqual([span])

      const sql = yield* SqlClient.SqlClient
      const rows = yield* sql<{ spanType: string; traceType: string }>`SELECT
        typeof(spanId) AS spanType,
        typeof(traceId) AS traceType
        FROM Span ORDER BY rowid`

      test
        .expect(rows)
        .toEqual([
          { spanType: "blob", traceType: "blob" },
          { spanType: "integer", traceType: "integer" },
        ])

      yield* StudioStore.insertMetrics([{
        name: "request.count",
        type: "counter",
        value: 1,
        tags: [],
        timestamp: 1,
        resource: {
          attributes: { "service.name": "api" },
          droppedAttributesCount: 0,
          schemaUrl: undefined,
        },
      }, {
        name: "request.count",
        type: "counter",
        value: 2,
        tags: [],
        timestamp: 1,
        resource: {
          attributes: { "service.name": "worker" },
          droppedAttributesCount: 0,
          schemaUrl: undefined,
        },
      }])

      const metricSeries = yield* StudioStore.latestMetricsWithHistory(10)

      test
        .expect(metricSeries.map((series) => series.latest.resource?.attributes["service.name"]))
        .toEqual(["api", "worker"])
    })
    .pipe(
      Effect.provide(BunSql.layer({ adapter: "sqlite", filename: ":memory:" })),
      Effect.runPromise,
    ))
