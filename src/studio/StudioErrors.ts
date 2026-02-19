import * as Cause from "effect/Cause"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FiberId from "effect/FiberId"
import * as FiberRef from "effect/FiberRef"
import * as HashMap from "effect/HashMap"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as PubSub from "effect/PubSub"
import type * as Context from "effect/Context"
import type * as Fiber from "effect/Fiber"
import * as Supervisor from "effect/Supervisor"
import * as StudioStore from "./StudioStore.ts"

function safeSerialize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "<deep>"
  if (value === null || value === undefined) return value
  if (typeof value === "bigint") return `${value}n`
  if (typeof value === "function") return undefined
  if (typeof value === "symbol") return value.toString()
  if (typeof value !== "object") return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return value.message
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => safeSerialize(v, depth + 1))
  const proto = Object.getPrototypeOf(value)
  if (proto !== null && proto !== Object.prototype) {
    if (typeof (value as any)._tag === "string") {
      return serializeTaggedObject(value as Record<string, unknown>, depth)
    }
    return `<${proto.constructor?.name ?? "object"}>`
  }
  return serializePlainObject(value as Record<string, unknown>, depth)
}

function serializePlainObject(
  obj: Record<string, unknown>,
  depth: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  let count = 0
  for (const [k, v] of Object.entries(obj)) {
    if (count >= 20) break
    if (typeof v === "function") continue
    const serialized = safeSerialize(v, depth + 1)
    if (serialized !== undefined) {
      out[k] = serialized
      count++
    }
  }
  return out
}

function serializeTaggedObject(
  obj: Record<string, unknown>,
  depth: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = { _tag: obj._tag }
  let count = 0
  for (const [k, v] of Object.entries(obj)) {
    if (count >= 20) break
    if (k === "_tag") continue
    if (typeof v === "function") continue
    if (k === "stack" || k === "name") continue
    const serialized = safeSerialize(v, depth + 1)
    if (serialized !== undefined) {
      out[k] = serialized
      count++
    }
  }
  return out
}

function extractTag(error: unknown): string | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    "_tag" in error &&
    typeof (error as any)._tag === "string"
  ) {
    return (error as any)._tag
  }
  return undefined
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  const tag = extractTag(error)
  if (tag) return tag
  try {
    return String(error)
  } catch {
    return "<unknown>"
  }
}

function extractProperties(error: unknown): Record<string, unknown> {
  if (error === null || error === undefined || typeof error !== "object") return {}
  const out: Record<string, unknown> = {}
  let count = 0
  for (const [k, v] of Object.entries(error)) {
    if (count >= 20) break
    if (k === "_tag" || k === "stack" || k === "name") continue
    if (typeof v === "function") continue
    const serialized = safeSerialize(v, 0)
    if (serialized !== undefined) {
      out[k] = serialized
      count++
    }
  }
  return out
}

const spanSymbol = Symbol.for("effect/SpanAnnotation")

function extractSpanName(error: unknown): string | undefined {
  if (error !== null && typeof error === "object" && spanSymbol in error) {
    const span = (error as any)[spanSymbol]
    return typeof span?.name === "string" ? span.name : undefined
  }
  return undefined
}

function extractDetails(cause: Cause.Cause<unknown>): Array<StudioStore.StudioErrorDetail> {
  const details: Array<StudioStore.StudioErrorDetail> = []

  const failures = Chunk.toArray(Cause.failures(cause))
  for (const error of failures) {
    details.push({
      kind: "fail",
      tag: extractTag(error),
      message: extractMessage(error),
      properties: extractProperties(error),
      span: extractSpanName(error),
    })
  }

  const defects = Chunk.toArray(Cause.defects(cause))
  for (const defect of defects) {
    details.push({
      kind: "die",
      tag: extractTag(defect),
      message: extractMessage(defect),
      properties: extractProperties(defect),
      span: extractSpanName(defect),
    })
  }

  return details
}

function make(store: StudioStore.StudioStoreShape): Supervisor.Supervisor<void> {
  return new (class extends Supervisor.AbstractSupervisor<void> {
    value = Effect.void

    onStart<A, E, R>(
      _context: Context.Context<R>,
      _effect: Effect.Effect<A, E, R>,
      parent: Option.Option<Fiber.RuntimeFiber<any, any>>,
      fiber: Fiber.RuntimeFiber<A, E>,
    ) {
      const childId = FiberId.threadName(fiber.id())
      const parentId = Option.isSome(parent) ? FiberId.threadName(parent.value.id()) : undefined

      const span = fiber.currentSpan
      const traceId = span
        ? (() => {
            try {
              return BigInt(span.traceId)
            } catch {
              return undefined
            }
          })()
        : undefined
      const annotations: Record<string, unknown> = {}
      const spanAnnotations = fiber.getFiberRef(FiberRef.currentTracerSpanAnnotations)
      HashMap.forEach(spanAnnotations, (value, key) => {
        annotations[key] = value
      })
      const logAnnotations = fiber.getFiberRef(FiberRef.currentLogAnnotations)
      HashMap.forEach(logAnnotations, (value, key) => {
        annotations[key] = value
      })

      StudioStore.runWrite(
        StudioStore.upsertFiber(
          store.sql,
          childId,
          parentId !== childId ? parentId : undefined,
          span?._tag === "Span" ? span.name : undefined,
          traceId,
          annotations,
        ),
      )
    }

    onEnd<A, E>(exit: Exit.Exit<A, E>, fiber: Fiber.RuntimeFiber<A, E>) {
      if (Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause)) {
        const error: StudioStore.StudioError = {
          id: StudioStore.nextErrorId(),
          fiberId: FiberId.threadName(fiber.id()),
          interrupted: Cause.isInterrupted(exit.cause),
          prettyPrint: Cause.pretty(exit.cause, { renderErrorCause: true }),
          details: extractDetails(exit.cause),
        }
        StudioStore.runWrite(
          Effect.zipRight(
            StudioStore.insertError(store.sql, error),
            StudioStore.evict(store.sql, "Error", store.errorCapacity),
          ),
        )
        Effect.runSync(PubSub.publish(store.events, { _tag: "Error", error }))
      }
    }
  })()
}

export const layer: Layer.Layer<never, never, StudioStore.StudioStore> = Layer.unwrapEffect(
  Effect.gen(function* () {
    const store = yield* StudioStore.StudioStore
    return Supervisor.addSupervisor(make(store))
  }),
)
