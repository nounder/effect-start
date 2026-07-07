import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as FiberId from "effect/FiberId"
import * as Option from "effect/Option"
import * as Tracer from "effect/Tracer"
import * as Unique from "../Unique.ts"

export interface Span {
  readonly spanId: string
  readonly traceId: string
  readonly fiberId: string | undefined
  readonly name: string
  readonly kind: string
  readonly parentSpanId: string | undefined
  startTime: bigint
  endTime: bigint | undefined
  durationMs: number | undefined
  status: "started" | "ok" | "error"
  readonly attributes: Record<string, unknown>
  readonly events: Array<
    { name: string; startTime: bigint; attributes?: Record<string, unknown> }
  >
}

export const nextPackedId = (): bigint => Unique.snowflake()

export const nextSpanId = (): string => nextPackedId().toString()

export const nextTraceId = (): string => nextPackedId().toString()

export const statusFromExit = (
  exit: Exit.Exit<unknown, unknown>,
): { status: "ok" | "error"; interrupted: boolean } => {
  const interrupted = Exit.isFailure(exit) && Cause.isInterruptedOnly(exit.cause)
  return {
    status: Exit.isSuccess(exit) || interrupted ? "ok" : "error",
    interrupted,
  }
}

export const makeTracer = (spans: Array<Span>): Tracer.Tracer =>
  Tracer.make({
    span(name, parent, context, links, startTime, kind) {
      const parentSpanId = Option.isSome(parent) && parent.value._tag === "Span"
        ? parent.value.spanId
        : undefined
      const traceId = Option.isSome(parent) ? parent.value.traceId : nextTraceId()
      const spanId = nextSpanId()
      const currentFiber = Fiber.getCurrentFiber()
      const fiberId = Option.isSome(currentFiber) ? FiberId.threadName(currentFiber.value.id()) : undefined

      const record: Span = {
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
      let endExit: Exit.Exit<unknown, unknown> = Exit.void
      const span: Tracer.Span = {
        _tag: "Span",
        name,
        spanId,
        traceId,
        parent,
        context,
        get status(): Tracer.SpanStatus {
          return record.endTime != null
            ? { _tag: "Ended", startTime: record.startTime, endTime: record.endTime, exit: endExit }
            : { _tag: "Started", startTime: record.startTime }
        },
        attributes: attrs,
        links: spanLinks,
        sampled: true,
        kind,
        end(endTime, exit) {
          endExit = exit
          record.endTime = endTime
          record.durationMs = Number(endTime - record.startTime) / 1_000_000
          const ending = statusFromExit(exit)
          record.status = ending.status
          if (ending.interrupted) {
            attrs.set("status.interrupted", true)
            record.attributes["status.interrupted"] = true
          }
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
