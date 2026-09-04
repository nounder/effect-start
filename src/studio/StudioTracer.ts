import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as PubSub from "effect/PubSub"
import * as Tracer from "effect/Tracer"
import * as Tracing from "../internal/Tracing.ts"
import * as StudioContext from "./internal/StudioContext.ts"
import * as StudioStore from "./StudioStore.ts"

const publish = (store: StudioStore.State, event: StudioStore.StudioEvent) =>
  Effect.runSync(PubSub.publish(store.events, event))

function serialize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "<deep>"
  if (value === null || value === undefined) return value
  if (typeof value === "bigint") return `${value}n`
  if (typeof value === "function") return undefined
  if (typeof value === "symbol") return value.toString()
  if (typeof value !== "object") return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return value.message
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => serialize(item, depth + 1))
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== null && prototype !== Object.prototype && typeof (value as { _tag?: unknown })._tag !== "string") {
    return `<${prototype.constructor?.name ?? "object"}>`
  }
  const output: Record<string, unknown> = {}
  let count = 0
  for (const [key, item] of Object.entries(value)) {
    if (count >= 20) break
    if (key === "stack" || key === "name" || typeof item === "function") continue
    const serialized = serialize(item, depth + 1)
    if (serialized !== undefined) {
      output[key] = serialized
      count++
    }
  }
  return output
}

function errorDetail(
  reason: Cause.Fail<unknown> | Cause.Die,
  span: string,
): StudioStore.ErrorDetail {
  const error = Cause.isFailReason(reason) ? reason.error : reason.defect
  const tag = error !== null && typeof error === "object" && typeof (error as { _tag?: unknown })._tag === "string"
    ? (error as { readonly _tag: string })._tag
    : undefined
  const properties: Record<string, unknown> = {}
  if (error !== null && typeof error === "object") {
    let count = 0
    for (const [key, value] of Object.entries(error)) {
      if (count >= 20) break
      if (key === "_tag" || key === "stack" || key === "name" || typeof value === "function") continue
      const serialized = serialize(value)
      if (serialized !== undefined) {
        properties[key] = serialized
        count++
      }
    }
  }
  return {
    kind: Cause.isFailReason(reason) ? "fail" : "die",
    tag,
    message: error instanceof Error ? error.message || tag || error.name : tag ?? String(error),
    properties,
    span,
  }
}

const make = (store: StudioStore.State): Tracer.Tracer =>
  Tracer.make({
    span(options) {
      const { name, parent, annotations, links, startTime, kind } = options
      const parentSpanId = Option.isSome(parent) && parent.value._tag === "Span"
        ? parent.value.spanId
        : undefined
      const parentTraceId = Option.isSome(parent)
        ? parent.value.traceId
        : undefined
      const traceId = parentTraceId ?? Tracing.nextTraceId()
      const spanId = Tracing.nextSpanId()

      const attributes: Record<string, unknown> = {}
      const currentFiber = Fiber.getCurrent()
      const fiberId = currentFiber !== undefined
        ? `#${currentFiber.id}`
        : undefined
      if (fiberId) {
        attributes["fiber.id"] = fiberId
        StudioStore.runWrite(
          store,
          StudioStore.upsertFiber(fiberId, undefined, name, BigInt(`0x${traceId}`), {}),
        )
      }
      const studioSpan: Tracing.Span = {
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
        attributes,
        events: [],
      }

      StudioStore.runWrite(
        store,
        Effect.andThen(
          StudioStore.insertSpan(studioSpan),
          StudioStore.evictSpans(store.spanCapacity),
        ),
      )
      publish(store, { _tag: "SpanStart", span: studioSpan })
      if (parentSpanId === undefined) {
        publish(store, { _tag: "TraceStart", traceId })
      }

      const attrs = new Map<string, unknown>(Object.entries(attributes))
      const spanLinks = [...links]
      let endExit: Exit.Exit<unknown, unknown> = Exit.void

      const span: Tracer.Span = {
        _tag: "Span",
        name,
        spanId,
        traceId,
        parent,
        annotations,
        get status(): Tracer.SpanStatus {
          if (studioSpan.endTime != null) {
            return {
              _tag: "Ended",
              startTime: studioSpan.startTime,
              endTime: studioSpan.endTime,
              exit: endExit,
            }
          }
          return { _tag: "Started", startTime: studioSpan.startTime }
        },
        attributes: attrs,
        links: spanLinks,
        sampled: true,
        kind,
        end(endTime, exit) {
          endExit = exit
          studioSpan.endTime = endTime
          studioSpan.durationMs = Number(endTime - studioSpan.startTime) /
            1_000_000
          const ending = Tracing.statusFromExit(exit)
          studioSpan.status = ending.status
          if (ending.interrupted) {
            attrs.set("status.interrupted", true)
            ;(studioSpan.attributes as Record<string, unknown>)["status.interrupted"] = true
          }
          StudioStore.runWrite(store, StudioStore.updateSpan(studioSpan))
          if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) {
            const details: Array<StudioStore.ErrorDetail> = exit.cause.reasons.flatMap((reason) => {
              if (Cause.isInterruptReason(reason)) return []
              return [errorDetail(reason, name)]
            })
            const error: StudioStore.ErrorEntry = {
              id: Tracing.nextPackedId(),
              fiberId: fiberId ?? "#0",
              interrupted: exit.cause.reasons.some(Cause.isInterruptReason),
              prettyPrint: Cause.pretty(exit.cause),
              details,
            }
            StudioStore.runWrite(
              store,
              Effect.andThen(
                StudioStore.insertError(error),
                StudioStore.evict("Error", store.errorCapacity),
              ),
            )
            publish(store, { _tag: "Error", error })
          }
          publish(store, { _tag: "SpanEnd", span: studioSpan })
          if (parentSpanId === undefined) {
            publish(store, { _tag: "TraceEnd", traceId })
          }
        },
        attribute(key, value) {
          attrs.set(key, value)
          ;(studioSpan.attributes as Record<string, unknown>)[key] = value
          StudioStore.runWrite(store, StudioStore.updateSpan(studioSpan))
        },
        event(name, startTime, attributes) {
          studioSpan.events.push({ name, startTime, attributes })
          StudioStore.runWrite(store, StudioStore.updateSpan(studioSpan))
        },
        addLinks(newLinks) {
          spanLinks.push(...newLinks)
        },
      }
      return span
    },
  })

export const layer: Layer.Layer<never, never, StudioContext.Studio> = Layer
  .unwrap(
    Effect.gen(function*() {
      const studio = yield* StudioContext.Studio
      return Layer.succeed(Tracer.Tracer, make(studio.store))
    }),
  )
