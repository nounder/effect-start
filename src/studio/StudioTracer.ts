import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as FiberId from "effect/FiberId"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as PubSub from "effect/PubSub"
import * as Tracer from "effect/Tracer"
import * as StudioStore from "./StudioStore.ts"

const publish = (store: StudioStore.StudioStoreShape, event: StudioStore.StudioEvent) =>
  Effect.runSync(PubSub.publish(store.events, event))

const fromTracerId = (id: string): bigint | undefined => {
  try {
    return BigInt(id)
  } catch {
    return undefined
  }
}

const make = (store: StudioStore.StudioStoreShape): Tracer.Tracer =>
  Tracer.make({
    span(name, parent, context, links, startTime, kind, options) {
      const parentSpanId =
        Option.isSome(parent) && parent.value._tag === "Span"
          ? fromTracerId(parent.value.spanId)
          : undefined
      const parentTraceId = Option.isSome(parent) ? fromTracerId(parent.value.traceId) : undefined
      const traceId = parentTraceId ?? StudioStore.nextTraceId()
      const spanId = StudioStore.nextSpanId()

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

      const studioSpan: StudioStore.StudioSpan = {
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
        Effect.zipRight(
          StudioStore.insertSpan(store.sql, studioSpan),
          StudioStore.evict(store.sql, "Span", store.spanCapacity),
        ),
      )
      publish(store, { _tag: "SpanStart", span: studioSpan })

      const attrs = new Map<string, unknown>(Object.entries(attributes))
      const spanLinks = [...links]

      const span: Tracer.Span = {
        _tag: "Span",
        name,
        spanId: String(spanId),
        traceId: String(traceId),
        parent,
        context,
        get status(): Tracer.SpanStatus {
          if (studioSpan.endTime != null) {
            return {
              _tag: "Ended",
              startTime: studioSpan.startTime,
              endTime: studioSpan.endTime,
              exit: Exit.void,
            }
          }
          return { _tag: "Started", startTime: studioSpan.startTime }
        },
        attributes: attrs,
        links: spanLinks,
        sampled: true,
        kind,
        end(endTime, exit) {
          studioSpan.endTime = endTime
          studioSpan.durationMs = Number(endTime - studioSpan.startTime) / 1_000_000
          studioSpan.status = Exit.isSuccess(exit) ? "ok" : "error"
          StudioStore.runWrite(StudioStore.updateSpan(store.sql, studioSpan))
          publish(store, { _tag: "SpanEnd", span: studioSpan })
        },
        attribute(key, value) {
          attrs.set(key, value)
          ;(studioSpan.attributes as Record<string, unknown>)[key] = value
          StudioStore.runWrite(StudioStore.updateSpan(store.sql, studioSpan))
        },
        event(name, startTime, attributes) {
          studioSpan.events.push({ name, startTime, attributes })
          StudioStore.runWrite(StudioStore.updateSpan(store.sql, studioSpan))
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

export const layer: Layer.Layer<never, never, StudioStore.StudioStore> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const store = yield* StudioStore.StudioStore
    return Layer.setTracer(make(store))
  }),
)
