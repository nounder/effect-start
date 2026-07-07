import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as FiberId from "effect/FiberId"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as PubSub from "effect/PubSub"
import * as Tracer from "effect/Tracer"
import * as Tracing from "../internal/Tracing.ts"
import * as Studio from "./Studio.ts"
import * as StudioStore from "./StudioStore.ts"

const publish = (store: StudioStore.State, event: StudioStore.StudioEvent) =>
  Effect.runSync(PubSub.publish(store.events, event))

const make = (store: StudioStore.State): Tracer.Tracer =>
  Tracer.make({
    span(name, parent, context, links, startTime, kind, options) {
      const parentSpanId = Option.isSome(parent) && parent.value._tag === "Span"
        ? parent.value.spanId
        : undefined
      const parentTraceId = Option.isSome(parent)
        ? parent.value.traceId
        : undefined
      const traceId = parentTraceId ?? Tracing.nextTraceId()
      const spanId = Tracing.nextSpanId()

      const attributes: Record<string, unknown> = {}
      const currentFiber = Fiber.getCurrentFiber()
      const fiberId = Option.isSome(currentFiber)
        ? FiberId.threadName(currentFiber.value.id())
        : undefined
      if (fiberId) {
        attributes["fiber.id"] = fiberId
      }
      if (typeof options?.captureStackTrace === "function") {
        const stacktrace = options.captureStackTrace()
        if (stacktrace) {
          attributes["code.stacktrace"] = stacktrace
        }
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
        Effect.zipRight(
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
        context,
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
    context(f) {
      return f()
    },
  })

export const layer: Layer.Layer<never, never, Studio.Studio> = Layer
  .unwrapEffect(
    Effect.gen(function*() {
      const studio = yield* Studio.Studio
      return Layer.setTracer(make(studio.store))
    }),
  )
