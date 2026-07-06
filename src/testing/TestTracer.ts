import * as Config from "effect/Config"
import * as Console from "effect/Console"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Tracing from "../internal/Tracing.ts"

export type Span = Tracing.Span

const jsonValue = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value
  }
  if (Array.isArray(value)) return value.map(jsonValue)
  return value === undefined ? "undefined" : String(value)
}

type Row = {
  readonly id: string
  readonly parentId: string | undefined
  readonly name: string
  readonly startMs: number
  readonly durationMs: number
  readonly attributes: Record<string, unknown>
}

const rowsFromSpans = (spans: ReadonlyArray<Tracing.Span>): ReadonlyArray<Row> => {
  const startedAt = spans.reduce((min, span) => span.startTime < min ? span.startTime : min, spans[0].startTime)
  return spans
    .map((span): Row => ({
      id: span.spanId,
      parentId: span.parentSpanId,
      name: span.name,
      startMs: Math.round(Number(span.startTime - startedAt) / 1_000_000),
      durationMs: Math.round(span.durationMs ?? 0),
      attributes: Object.fromEntries(
        Object.entries(span.attributes).map(([key, value]) => [key, jsonValue(value)]),
      ),
    }))
    .sort((a, b) => a.startMs - b.startMs || b.durationMs - a.durationMs)
}

const formatTrace = (
  spans: ReadonlyArray<Tracing.Span>,
  json: boolean,
  filter: (span: Tracing.Span) => boolean,
) => {
  if (spans.length === 0) return "[trace] no spans"
  const kept = new Set(
    spans.filter((span) => span.parentSpanId === undefined || filter(span)).map((span) => span.spanId),
  )
  const rows = rowsFromSpans(spans)
  const selected = rows.filter((row) => kept.has(row.id))
  const selectedIds = new Set(selected.map((row) => row.id))
  const byId = new Map(rows.map((row) => [row.id, row]))
  const children = new Map<string | undefined, Array<Row>>()

  const visibleParent = (row: Row): string | undefined => {
    let parentId = row.parentId
    while (parentId !== undefined && !selectedIds.has(parentId)) parentId = byId.get(parentId)?.parentId
    return parentId
  }

  for (const row of selected) {
    const parentId = visibleParent(row)
    children.set(parentId, [...(children.get(parentId) ?? []), row])
  }

  const formatRow = (row: Row, depth: number): ReadonlyArray<string> => {
    const attrs = Object.keys(row.attributes).length === 0 ? "" : ` ${JSON.stringify(row.attributes)}`
    return [
      `${"  ".repeat(depth)}- +${row.startMs}ms ${row.durationMs}ms ${row.name}${attrs}`,
      ...(children.get(row.id) ?? []).flatMap((child) => formatRow(child, depth + 1)),
    ]
  }

  const out = [
    "[trace]",
    ...((children.get(undefined) ?? []).flatMap((row) => formatRow(row, 0))),
  ]
  if (json) {
    const serialized = selected.map((row) => ({
      ...row,
      parentId: row.parentId ?? null,
    }))
    out.push("[trace json]", JSON.stringify(serialized, null, 2))
  }
  return out.join("\n")
}

export const filterDuration = (minDuration: Duration.DurationInput) => {
  const minDurationMs = Duration.toMillis(minDuration)
  return (span: Span) => (span.durationMs ?? 0) >= minDurationMs
}

const tracePrint = Effect.orElseSucceed(Config.boolean("TRACE_PRINT"), () => false)

export const layer = (
  options: { readonly json?: boolean; readonly filter?: (span: Span) => boolean } = {},
): Layer.Layer<never> => {
  const json = options.json ?? false
  const filter = options.filter ?? filterDuration("50 millis")
  const spans: Array<Tracing.Span> = []
  return Layer.scopedDiscard(
    Effect.gen(function*() {
      yield* Effect.withTracerScoped(Tracing.makeTracer(spans))
      const print = yield* tracePrint
      if (print) {
        yield* Effect.addFinalizer(() => Console.log(formatTrace(spans, json, filter)))
      }
    }),
  )
}
