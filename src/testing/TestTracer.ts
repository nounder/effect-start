import * as Console from "effect/Console"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as FiberId from "effect/FiberId"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Tracer from "effect/Tracer"
import * as NProcess from "node:process"
import * as Tracing from "../internal/Tracing.ts"

export type Span = Tracing.Span

const enabled = (value: string | boolean | undefined = NProcess.env.TRACING) =>
  value === true || (typeof value === "string" && ["1", "true"].includes(value.trim().toLowerCase()))

const make = (spans: Array<Tracing.Span>): Tracer.Tracer =>
  Tracer.make({
    span(name, parent, context, links, startTime, kind) {
      const parentSpanId = Option.isSome(parent) && parent.value._tag === "Span"
        ? BigInt(parent.value.spanId)
        : undefined
      const traceId = Option.isSome(parent) ? BigInt(parent.value.traceId) : Tracing.nextTraceId()
      const spanId = Tracing.nextSpanId()
      const currentFiber = Fiber.getCurrentFiber()
      const fiberId = Option.isSome(currentFiber) ? FiberId.threadName(currentFiber.value.id()) : undefined

      const record: Tracing.Span = {
        spanId,
        traceId,
        fiberId,
        name,
        kind,
        parentSpanId,
        startTime,
        endTime: undefined,
        durationMs: undefined,
        status: "started",
        attributes: {},
        events: [],
      }
      spans.push(record)

      const attrs = new Map<string, unknown>()
      const spanLinks = [...links]
      const span: Tracer.Span = {
        _tag: "Span",
        name,
        spanId: String(spanId),
        traceId: String(traceId),
        parent,
        context,
        get status(): Tracer.SpanStatus {
          return record.endTime != null
            ? { _tag: "Ended", startTime: record.startTime, endTime: record.endTime, exit: Exit.void }
            : { _tag: "Started", startTime: record.startTime }
        },
        attributes: attrs,
        links: spanLinks,
        sampled: true,
        kind,
        end(endTime, exit) {
          record.endTime = endTime
          record.durationMs = Number(endTime - record.startTime) / 1_000_000
          record.status = Exit.isSuccess(exit) ? "ok" : "error"
        },
        attribute(key, value) {
          attrs.set(key, value)
          record.attributes[key] = value
        },
        event(name, startTime, attributes) {
          record.events.push({ name, startTime, attributes })
        },
        addLinks(newLinks) {
          spanLinks.push(...newLinks)
        },
      }
      return span
    },
    context(f) {
      return f()
    },
  })

const jsonValue = (value: unknown): unknown => {
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value
  }
  if (Array.isArray(value)) return value.map(jsonValue)
  return value === undefined ? "undefined" : String(value)
}

type Row = {
  readonly id: bigint
  readonly parentId: bigint | undefined
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
  const children = new Map<bigint | undefined, Array<Row>>()

  const visibleParent = (row: Row): bigint | undefined => {
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
      id: String(row.id),
      parentId: row.parentId === undefined ? null : String(row.parentId),
    }))
    out.push("[trace json]", JSON.stringify(serialized, null, 2))
  }
  return out.join("\n")
}

export const filterDuration = (minDuration: Duration.DurationInput) => {
  const minDurationMs = Duration.toMillis(minDuration)
  return (span: Span) => (span.durationMs ?? 0) >= minDurationMs
}

export const layerConfig = (
  options: { readonly json?: boolean; readonly filter?: (span: Span) => boolean } = {},
) => {
  if (!enabled()) return Layer.empty
  const json = options.json ?? false
  const filter = options.filter ?? filterDuration("50 millis")
  const spans: Array<Tracing.Span> = []
  return Layer.scopedDiscard(
    Effect.gen(function*() {
      yield* Effect.withTracerScoped(make(spans))
      yield* Effect.addFinalizer(() => Console.log(formatTrace(spans, json, filter)))
    }),
  )
}
