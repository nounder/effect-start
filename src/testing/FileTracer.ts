import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import type * as FileSystem from "../FileSystem.ts"
import * as FileWriter from "../FileWriter.ts"
import * as Tracing from "../internal/Tracing.ts"

export type Span = Tracing.Span

export const Row = Schema.Struct({
  id: Schema.String,
  traceId: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  name: Schema.String,
  startMs: Schema.Number,
  durationMs: Schema.Number,
  status: Schema.Literal("started", "ok", "error"),
  attributes: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

export type Row = typeof Row.Type

export const RowFromJson: Schema.Schema<Row, string> = Schema.parseJson(Row)

const encodeRow = Schema.encodeSync(RowFromJson)

export const filterDuration = (minDuration: Duration.DurationInput) => {
  const minDurationMs = Duration.toMillis(minDuration)
  return (span: Span) => (span.durationMs ?? 0) >= minDurationMs
}

const jsonValue = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value
  }
  if (Array.isArray(value)) return value.map(jsonValue)
  return value === undefined ? "undefined" : String(value)
}

const rowsFromSpans = (
  spans: ReadonlyArray<Tracing.Span>,
  filter: (span: Tracing.Span) => boolean,
): ReadonlyArray<Row> => {
  if (spans.length === 0) return []
  const startedAt = spans.reduce((min, span) => span.startTime < min ? span.startTime : min, spans[0].startTime)
  return spans
    .filter((span) => span.parentSpanId === undefined || filter(span))
    .map((span): Row => ({
      id: span.spanId,
      traceId: span.traceId,
      parentId: span.parentSpanId ?? null,
      name: span.name,
      startMs: Math.round(Number(span.startTime - startedAt) / 1_000_000),
      durationMs: Math.round(span.durationMs ?? 0),
      status: span.status,
      attributes: Object.fromEntries(
        Object.entries(span.attributes).map(([key, value]) => [key, jsonValue(value)]),
      ),
    }))
}

export interface Options extends FileWriter.Options {
  readonly filter?: ((span: Span) => boolean) | undefined
}

export const layer = (
  options: Options,
): Layer.Layer<never, never, FileSystem.FileSystem> => {
  const filter = options.filter ?? filterDuration("50 millis")
  const spans: Array<Tracing.Span> = []
  return Layer.scopedDiscard(
    Effect.gen(function*() {
      yield* Effect.withTracerScoped(Tracing.makeTracer(spans))
      const writer = yield* Effect.orDie(FileWriter.build(options))
      yield* Effect.addFinalizer(() => {
        const rows = rowsFromSpans(spans, filter)
        return rows.length === 0 ? Effect.void : writer.append(rows.map((row) => encodeRow(row)).join("\n"))
      })
    }),
  )
}
