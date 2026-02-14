import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import * as FiberId from "effect/FiberId"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as PubSub from "effect/PubSub"
import * as Tracer from "effect/Tracer"
import * as TowerStore from "./TowerStore.ts"

const publish = (store: TowerStore.TowerStoreShape, event: TowerStore.TowerEvent) =>
  Effect.runSync(PubSub.publish(store.events, event))

const fromTracerId = (id: string): bigint | undefined => {
  try {
    return BigInt(id)
  } catch {
    return undefined
  }
}

const make = (store: TowerStore.TowerStoreShape): Tracer.Tracer =>
  Tracer.make({
    span(name, parent, context, links, startTime, kind, options) {
      const parentSpanId =
        Option.isSome(parent) && parent.value._tag === "Span"
          ? fromTracerId(parent.value.spanId)
          : undefined
      const parentTraceId = Option.isSome(parent) ? fromTracerId(parent.value.traceId) : undefined
      const traceId = parentTraceId ?? TowerStore.nextTraceId()
      const spanId = TowerStore.nextSpanId()

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

      const towerSpan: TowerStore.TowerSpan = {
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

      TowerStore.runWrite(
        Effect.zipRight(
          TowerStore.insertSpan(store.sql, towerSpan),
          TowerStore.evict(store.sql, "Span", store.spanCapacity),
        ),
      )
      publish(store, { _tag: "SpanStart", span: towerSpan })

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
          if (towerSpan.endTime != null) {
            return {
              _tag: "Ended",
              startTime: towerSpan.startTime,
              endTime: towerSpan.endTime,
              exit: Exit.void,
            }
          }
          return { _tag: "Started", startTime: towerSpan.startTime }
        },
        attributes: attrs,
        links: spanLinks,
        sampled: true,
        kind,
        end(endTime, exit) {
          towerSpan.endTime = endTime
          towerSpan.durationMs = Number(endTime - towerSpan.startTime) / 1_000_000
          towerSpan.status = Exit.isSuccess(exit) ? "ok" : "error"
          TowerStore.runWrite(TowerStore.updateSpan(store.sql, towerSpan))
          publish(store, { _tag: "SpanEnd", span: towerSpan })
        },
        attribute(key, value) {
          attrs.set(key, value)
          ;(towerSpan.attributes as Record<string, unknown>)[key] = value
          TowerStore.runWrite(TowerStore.updateSpan(store.sql, towerSpan))
        },
        event(name, startTime, attributes) {
          towerSpan.events.push({ name, startTime, attributes })
          TowerStore.runWrite(TowerStore.updateSpan(store.sql, towerSpan))
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

export const layer: Layer.Layer<never, never, TowerStore.TowerStore> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const store = yield* TowerStore.TowerStore
    return Layer.setTracer(make(store))
  }),
)
