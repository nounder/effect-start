import * as Option from "effect/Option"

const EffectTypeIds: Record<symbol, string> = {
  [Symbol.for("effect/Ref")]: "Ref",
  [Symbol.for("effect/SynchronizedRef")]: "SynchronizedRef",
  [Symbol.for("effect/QueueDequeue")]: "Dequeue",
  [Symbol.for("effect/QueueEnqueue")]: "Enqueue",
  [Symbol.for("effect/Pool")]: "Pool",
  [Symbol.for("effect/Deferred")]: "Deferred",
  [Symbol.for("effect/FiberRef")]: "FiberRef",
  [Symbol.for("effect/Scope")]: "Scope",
  [Symbol.for("effect/Tracer")]: "Tracer",
  [Symbol.for("effect/Request/Cache")]: "RequestCache",
  [Symbol.for("effect/Logger")]: "Logger",
  [Symbol.for("effect/Supervisor")]: "Supervisor",
  [Symbol.for("effect/Clock")]: "Clock",
  [Symbol.for("effect/Random")]: "Random",
  [Symbol.for("effect/KeyValueStore")]: "KeyValueStore",
  [Symbol.for("effect/RateLimiter")]: "RateLimiter",
}

function detectEffectType(value: unknown): string | undefined {
  if (value === null || value === undefined || typeof value !== "object") return undefined
  if ("publish" in value && "subscribe" in value && "offer" in value) return "PubSub"
  for (const sym of Object.getOwnPropertySymbols(value)) {
    const name = EffectTypeIds[sym]
    if (name) return name
  }
  return undefined
}

function inspectEffectValue(type: string, value: any): Record<string, unknown> {
  const info: Record<string, unknown> = { _type: type }
  try {
    switch (type) {
      case "PubSub": {
        if (typeof value.capacity === "function") info.capacity = value.capacity()
        if (typeof value.isActive === "function") info.active = value.isActive()
        if (typeof value.unsafeSize === "function") {
          const size = value.unsafeSize()
          info.size = Option.isSome(size) ? size.value : "shutdown"
        }
        if (value.pubsub && typeof value.pubsub.subscriberCount === "number") {
          info.subscribers = value.pubsub.subscriberCount
        }
        break
      }
      case "Enqueue":
      case "Dequeue": {
        if (typeof value.capacity === "function") info.capacity = value.capacity()
        if (typeof value.isActive === "function") info.active = value.isActive()
        if (typeof value.unsafeSize === "function") {
          const size = value.unsafeSize()
          info.size = Option.isSome(size) ? size.value : "shutdown"
        }
        break
      }
      case "Ref":
      case "SynchronizedRef": {
        if (value.ref && "current" in value.ref) {
          const current = value.ref.current
          info.value = safeSerialize(current)
        }
        break
      }
      case "Pool": {
        if (typeof value.minSize === "number") info.minSize = value.minSize
        if (typeof value.maxSize === "number") info.maxSize = value.maxSize
        if (typeof value.concurrency === "number") info.concurrency = value.concurrency
        if (value.items instanceof Set) info.items = value.items.size
        if (value.available instanceof Set) info.available = value.available.size
        if (value.invalidated instanceof Set) info.invalidated = value.invalidated.size
        if (typeof value.waiters === "number") info.waiters = value.waiters
        break
      }
      case "FiberRef": {
        if ("initial" in value) info.initial = safeSerialize(value.initial)
        break
      }
      case "Deferred": {
        if ("state" in value && value.state) {
          const state = value.state
          if (typeof state === "object" && "_tag" in state) {
            info.status = state._tag
          }
        }
        break
      }
    }
  } catch {
    // ignore introspection errors
  }
  return info
}

function safeSerialize(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === "bigint") return `${value}n`
  if (typeof value === "function") return "<function>"
  if (typeof value === "symbol") return value.toString()
  if (typeof value !== "object") return value
  if (detectEffectType(value)) return `<${detectEffectType(value)}>`
  if (Array.isArray(value)) return value.map(safeSerialize)
  const proto = Object.getPrototypeOf(value)
  if (proto !== null && proto !== Object.prototype)
    return `<${proto.constructor?.name ?? "object"}>`
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "function") continue
    out[k] = safeSerialize(v)
  }
  return out
}

export interface ServiceEntry {
  readonly key: string
  readonly kind: string
  readonly display: string
  readonly type: "config" | "value" | "effect"
}

function isJsonPrimitive(value: unknown): boolean {
  if (value === null) return true
  const t = typeof value
  return t === "string" || t === "number" || t === "boolean" || t === "bigint"
}

function isPlainJson(value: unknown): boolean {
  if (isJsonPrimitive(value)) return true
  if (Array.isArray(value)) return value.every(isPlainJson)
  if (typeof value === "object" && value !== null) {
    const proto = Object.getPrototypeOf(value)
    if (proto !== null && proto !== Object.prototype) return false
    return Object.values(value).every(isPlainJson)
  }
  return false
}

function jsonReplacer(_key: string, v: unknown): unknown {
  if (typeof v === "bigint") return `${v}n`
  return v
}

function collectDisplayValues(obj: unknown, prefix: string, out: Record<string, unknown>): void {
  if (typeof obj === "function") return
  if (isJsonPrimitive(obj) || Array.isArray(obj)) {
    out[prefix] = safeSerialize(obj)
    return
  }
  if (typeof obj === "object" && obj !== null) {
    const et = detectEffectType(obj)
    if (et) {
      out[prefix || et] = inspectEffectValue(et, obj)
      return
    }
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "function") continue
      const path = prefix ? `${prefix}.${k}` : k
      if (isPlainJson(v)) {
        out[path] = safeSerialize(v)
      } else if (typeof v === "object" && v !== null) {
        collectDisplayValues(v, path, out)
      }
    }
  }
}

function kindColor(kind: string): { bg: string; fg: string } {
  if (kind === "config") return { bg: "#2d1f0e", fg: "#fbbf24" }
  if (kind === "effect") return { bg: "#2d1a3e", fg: "#c084fc" }
  if (kind === "empty") return { bg: "#1f2937", fg: "#64748b" }
  if (kind === "function") return { bg: "#1a2e1a", fg: "#4ade80" }
  return { bg: "#1e3a5f", fg: "#60a5fa" }
}

function ServiceRow(options: { entry: ServiceEntry }) {
  const colors = kindColor(options.entry.type)
  return (
    <details class="tl-row">
      <summary class="tl-summary tl-cols">
        <span class="tl-cell tl-cell-status">
          <span
            style={`width:8px;height:8px;border-radius:50%;background:${colors.fg};display:block`}
          />
        </span>
        <span class="tl-cell tl-cell-name">{options.entry.key}</span>
        <span class="tl-cell tl-cell-dur">
          <span
            style={`font-size:10px;padding:1px 6px;border-radius:4px;background:${colors.bg};color:${colors.fg}`}
          >
            {options.entry.kind}
          </span>
        </span>
      </summary>
      <div class="tl-body">
        {options.entry.display ? (
          <pre style="color:#e2e8f0;font-family:monospace;font-size:12px;margin:0;padding:8px;white-space:pre-wrap;word-break:break-all">
            {options.entry.display}
          </pre>
        ) : (
          <div style="padding:4px 8px;color:#64748b;font-size:12px">No inspectable values</div>
        )}
      </div>
    </details>
  )
}

export function ServiceList(options: { services: Array<ServiceEntry> }) {
  if (options.services.length === 0) {
    return <div class="empty">No services registered</div>
  }
  return (
    <div class="tl-grid">
      <div class="tl-header tl-cols">
        <span class="tl-cell tl-cell-status" />
        <span class="tl-cell tl-cell-name">Service</span>
        <span class="tl-cell tl-cell-dur">Kind</span>
      </div>
      {options.services.map((s) => (
        <ServiceRow entry={s} />
      ))}
    </div>
  )
}

export function collectServices(unsafeMap: Map<string, any>): Array<ServiceEntry> {
  const entries: Array<ServiceEntry> = []
  for (const [key, value] of unsafeMap) {
    const isConfig =
      key.toLowerCase().includes("config") || key.toLowerCase().includes("configuration")

    const effectType =
      typeof value === "object" && value !== null ? detectEffectType(value) : undefined
    if (effectType) {
      const info = inspectEffectValue(effectType, value)
      entries.push({
        key,
        kind: effectType,
        display: JSON.stringify(info, jsonReplacer, 2),
        type: "effect",
      })
      continue
    }

    if (typeof value === "function") {
      entries.push({ key, kind: "function", display: "", type: "value" })
      continue
    }

    if (value === null || value === undefined) {
      entries.push({ key, kind: "empty", display: "", type: "value" })
      continue
    }

    const type = isConfig ? ("config" as const) : ("value" as const)
    const plain: Record<string, unknown> = {}
    collectDisplayValues(value, "", plain)
    const display = Object.keys(plain).length > 0 ? JSON.stringify(plain, jsonReplacer, 2) : ""

    let kind = "object"
    if (typeof value !== "object") {
      kind = typeof value
    } else {
      const proto = Object.getPrototypeOf(value)
      if (proto && proto.constructor && proto.constructor.name !== "Object") {
        kind = proto.constructor.name
      }
    }

    entries.push({ key, kind: isConfig ? "config" : kind, display, type })
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key))
}
