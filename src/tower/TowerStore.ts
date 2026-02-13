import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as GlobalValue from "effect/GlobalValue"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as PubSub from "effect/PubSub"
import * as Schema from "effect/Schema"
import * as Sql from "../sql/SqlClient.ts"

export let store: TowerStoreShape = GlobalValue.globalValue(
  Symbol.for("effect-start/TowerStore"),
  () => ({
    prefix: "/tower",
    sql: undefined as unknown as Sql.SqlClient,
    events: Effect.runSync(PubSub.unbounded<TowerEvent>()),
    spanCapacity: 1000,
    logCapacity: 5000,
    errorCapacity: 1000,
    metrics: [] as Array<TowerMetricSnapshot>,
    process: undefined as ProcessStats | undefined,
  }),
)

export interface TowerSpan {
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
  readonly events: Array<{ name: string; startTime: bigint; attributes?: Record<string, unknown> }>
}

export interface TowerLog {
  readonly id: string
  readonly date: Date
  readonly level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "FATAL"
  readonly message: string
  readonly fiberId: string
  readonly cause: string | undefined
  readonly spans: Array<string>
  readonly annotations: Record<string, unknown>
}

export interface ProcessStats {
  readonly pid: number
  readonly uptime: number
  readonly memory: {
    readonly rss: number
    readonly heapUsed: number
    readonly heapTotal: number
    readonly external: number
    readonly arrayBuffers: number
  }
  readonly cpu: { readonly user: number; readonly system: number }
  readonly resourceUsage: {
    readonly maxRSS: number
    readonly minorPageFault: number
    readonly majorPageFault: number
    readonly fsRead: number
    readonly fsWrite: number
    readonly voluntaryContextSwitches: number
    readonly involuntaryContextSwitches: number
  }
  readonly system: {
    readonly loadavg: readonly [number, number, number]
    readonly freemem: number
    readonly totalmem: number
    readonly cpuCount: number
    readonly platform: string
    readonly arch: string
  }
}

export interface TowerErrorDetail {
  readonly kind: "fail" | "die"
  readonly tag: string | undefined
  readonly message: string
  readonly properties: Record<string, unknown>
  readonly span: string | undefined
}

export interface TowerError {
  readonly id: string
  readonly date: Date
  readonly fiberId: string
  readonly interrupted: boolean
  readonly prettyPrint: string
  readonly details: Array<TowerErrorDetail>
}

export interface TowerMetricSnapshot {
  readonly name: string
  readonly type: "counter" | "gauge" | "histogram" | "summary" | "frequency"
  readonly value: unknown
  readonly tags: ReadonlyArray<{ key: string; value: string }>
  readonly timestamp: number
}

export type TowerEvent =
  | { readonly _tag: "SpanStart"; readonly span: TowerSpan }
  | { readonly _tag: "SpanEnd"; readonly span: TowerSpan }
  | { readonly _tag: "Log"; readonly log: TowerLog }
  | { readonly _tag: "Error"; readonly error: TowerError }
  | { readonly _tag: "MetricsSnapshot"; readonly metrics: Array<TowerMetricSnapshot> }
  | { readonly _tag: "ProcessSnapshot"; readonly stats: ProcessStats }

export interface FiberContext {
  readonly spanName: string | undefined
  readonly traceId: string | undefined
  readonly annotations: Record<string, unknown>
}

export interface TowerStoreShape {
  prefix: string
  readonly sql: Sql.SqlClient
  readonly events: PubSub.PubSub<TowerEvent>
  readonly spanCapacity: number
  readonly logCapacity: number
  readonly errorCapacity: number
  metrics: Array<TowerMetricSnapshot>
  process: ProcessStats | undefined
}

export function fiberIdCounter(): number {
  const counter = GlobalValue.globalValue(Symbol.for("effect/Fiber/Id/_fiberCounter"), () =>
    MutableRef.make(0),
  )
  return MutableRef.get(counter)
}

export class TowerStore extends Context.Tag("effect-start/TowerStore")<
  TowerStore,
  TowerStoreShape
>() {}

export interface TowerStoreOptions {
  readonly spanCapacity?: number
  readonly logCapacity?: number
  readonly errorCapacity?: number
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS Span (
    spanId TEXT PRIMARY KEY,
    traceId TEXT NOT NULL,
    fiberId TEXT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    parentSpanId TEXT,
    startTime TEXT NOT NULL,
    endTime TEXT,
    durationMs REAL,
    status TEXT NOT NULL,
    attributes TEXT NOT NULL,
    events TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Log (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    fiberId TEXT NOT NULL,
    cause TEXT,
    spans TEXT NOT NULL,
    annotations TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Error (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    fiberId TEXT NOT NULL,
    interrupted INTEGER NOT NULL,
    prettyPrint TEXT NOT NULL,
    details TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Fiber (
    id TEXT PRIMARY KEY,
    parentId TEXT,
    spanName TEXT,
    traceId TEXT,
    annotations TEXT NOT NULL
  )`,
]

export function layer(options?: TowerStoreOptions): Layer.Layer<TowerStore, Sql.SqlError, Sql.SqlClient> {
  return Layer.effect(
    TowerStore,
    Effect.gen(function* () {
      const sql = yield* Sql.SqlClient
      for (const ddl of DDL) {
        yield* sql.unsafe(ddl)
      }
      store = {
        ...store,
        sql,
        spanCapacity: options?.spanCapacity ?? 1000,
        logCapacity: options?.logCapacity ?? 5000,
        errorCapacity: options?.errorCapacity ?? 1000,
      }
      return store
    }),
  )
}

function serializeBigint(value: unknown): unknown {
  if (typeof value === "bigint") return `__bigint__${value}`
  if (Array.isArray(value)) return value.map(serializeBigint)
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeBigint(v)
    }
    return out
  }
  return value
}

function reviveBigint(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("__bigint__")) return BigInt(value.slice(10))
  if (Array.isArray(value)) return value.map(reviveBigint)
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = reviveBigint(v)
    }
    return out
  }
  return value
}

export const SpanRow = Schema.Struct({
  spanId: Schema.String,
  traceId: Schema.String,
  fiberId: Schema.NullOr(Schema.String),
  name: Schema.String,
  kind: Schema.String,
  parentSpanId: Schema.NullOr(Schema.String),
  startTime: Schema.String,
  endTime: Schema.NullOr(Schema.String),
  durationMs: Schema.NullOr(Schema.Number),
  status: Schema.String,
  attributes: Schema.String,
  events: Schema.String,
})
type SpanRow = typeof SpanRow.Type

export const LogRow = Schema.Struct({
  id: Schema.String,
  date: Schema.String,
  level: Schema.String,
  message: Schema.String,
  fiberId: Schema.String,
  cause: Schema.NullOr(Schema.String),
  spans: Schema.String,
  annotations: Schema.String,
})
type LogRow = typeof LogRow.Type

export const ErrorRow = Schema.Struct({
  id: Schema.String,
  date: Schema.String,
  fiberId: Schema.String,
  interrupted: Schema.Number,
  prettyPrint: Schema.String,
  details: Schema.String,
})
type ErrorRow = typeof ErrorRow.Type

export const FiberRow = Schema.Struct({
  id: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  spanName: Schema.NullOr(Schema.String),
  traceId: Schema.NullOr(Schema.String),
  annotations: Schema.String,
})
type FiberRow = typeof FiberRow.Type

function deserializeSpan(row: SpanRow): TowerSpan {
  const events = reviveBigint(JSON.parse(row.events)) as TowerSpan["events"]
  return {
    spanId: row.spanId,
    traceId: row.traceId,
    fiberId: row.fiberId ?? undefined,
    name: row.name,
    kind: row.kind,
    parentSpanId: row.parentSpanId ?? undefined,
    startTime: BigInt(row.startTime),
    endTime: row.endTime ? BigInt(row.endTime) : undefined,
    durationMs: row.durationMs ?? undefined,
    status: row.status as TowerSpan["status"],
    attributes: JSON.parse(row.attributes),
    events,
  }
}

function deserializeLog(row: LogRow): TowerLog {
  return {
    id: row.id,
    date: new Date(row.date),
    level: row.level as TowerLog["level"],
    message: row.message,
    fiberId: row.fiberId,
    cause: row.cause ?? undefined,
    spans: JSON.parse(row.spans),
    annotations: JSON.parse(row.annotations),
  }
}

function deserializeError(row: ErrorRow): TowerError {
  return {
    id: row.id,
    date: new Date(row.date),
    fiberId: row.fiberId,
    interrupted: row.interrupted === 1,
    prettyPrint: row.prettyPrint,
    details: JSON.parse(row.details),
  }
}

export function insertSpan(sql: Sql.SqlClient, span: TowerSpan) {
  return sql`INSERT INTO Span ${sql({
    spanId: span.spanId,
    traceId: span.traceId,
    fiberId: span.fiberId ?? null,
    name: span.name,
    kind: span.kind,
    parentSpanId: span.parentSpanId ?? null,
    startTime: span.startTime.toString(),
    endTime: span.endTime?.toString() ?? null,
    durationMs: span.durationMs ?? null,
    status: span.status,
    attributes: JSON.stringify(span.attributes),
    events: JSON.stringify(serializeBigint(span.events)),
  })}`
}

export function updateSpan(sql: Sql.SqlClient, span: TowerSpan) {
  return sql`UPDATE Span SET
    endTime = ${span.endTime?.toString() ?? null},
    durationMs = ${span.durationMs ?? null},
    status = ${span.status},
    attributes = ${JSON.stringify(span.attributes)},
    events = ${JSON.stringify(serializeBigint(span.events))}
    WHERE spanId = ${span.spanId}`
}

export function insertLog(sql: Sql.SqlClient, log: TowerLog) {
  return sql`INSERT INTO Log ${sql({
    id: log.id,
    date: log.date.toISOString(),
    level: log.level,
    message: log.message,
    fiberId: log.fiberId,
    cause: log.cause ?? null,
    spans: JSON.stringify(log.spans),
    annotations: JSON.stringify(log.annotations),
  })}`
}

export function insertError(sql: Sql.SqlClient, error: TowerError) {
  return sql`INSERT INTO Error ${sql({
    id: error.id,
    date: error.date.toISOString(),
    fiberId: error.fiberId,
    interrupted: error.interrupted ? 1 : 0,
    prettyPrint: error.prettyPrint,
    details: JSON.stringify(error.details),
  })}`
}

export function upsertFiber(
  sql: Sql.SqlClient,
  id: string,
  parentId: string | undefined,
  spanName: string | undefined,
  traceId: string | undefined,
  annotations: Record<string, unknown>,
) {
  return sql`INSERT OR REPLACE INTO Fiber ${sql({
    id,
    parentId: parentId ?? null,
    spanName: spanName ?? null,
    traceId: traceId ?? null,
    annotations: JSON.stringify(annotations),
  })}`
}

export function evict(sql: Sql.SqlClient, table: string, capacity: number) {
  return Effect.gen(function* () {
    const [{ cnt }] = yield* sql<{ cnt: number }>`SELECT count(*) as cnt FROM ${sql(table)}`
    if (cnt > capacity) {
      const excess = cnt - capacity
      yield* sql`DELETE FROM ${sql(table)} WHERE rowid IN (SELECT rowid FROM ${sql(table)} ORDER BY rowid LIMIT ${excess})`
    }
  })
}

export function runWrite(effect: Effect.Effect<unknown, Sql.SqlError>) {
  writeQueue = writeQueue
    .then(() => Effect.runPromise(Effect.withTracerEnabled(effect, false)).then(() => undefined))
    .catch(() => undefined)
}

let writeQueue = Promise.resolve<void>(undefined)

const noTrace = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, E> =>
  Effect.withTracerEnabled(effect, false)

export function allSpans(sql: Sql.SqlClient) {
  return noTrace(Effect.map(
    sql<SpanRow>`SELECT * FROM Span ORDER BY rowid`,
    (rows) => rows.map(deserializeSpan),
  ))
}

export function allLogs(sql: Sql.SqlClient) {
  return noTrace(Effect.map(
    sql<LogRow>`SELECT * FROM Log ORDER BY rowid`,
    (rows) => rows.map(deserializeLog),
  ))
}

export function allErrors(sql: Sql.SqlClient) {
  return noTrace(Effect.map(
    sql<ErrorRow>`SELECT * FROM Error ORDER BY rowid`,
    (rows) => rows.map(deserializeError),
  ))
}

export function spansByTraceId(sql: Sql.SqlClient, traceId: string) {
  return noTrace(Effect.map(
    sql<SpanRow>`SELECT * FROM Span WHERE traceId = ${traceId} ORDER BY rowid`,
    (rows) => rows.map(deserializeSpan),
  ))
}

export function spansByFiberId(sql: Sql.SqlClient, fiberId: string) {
  return noTrace(Effect.map(
    sql<SpanRow>`SELECT * FROM Span WHERE fiberId = ${fiberId} ORDER BY rowid`,
    (rows) => rows.map(deserializeSpan),
  ))
}

export function logsByFiberId(sql: Sql.SqlClient, fiberId: string) {
  return noTrace(Effect.map(
    sql<LogRow>`SELECT * FROM Log WHERE fiberId = ${fiberId} ORDER BY rowid`,
    (rows) => rows.map(deserializeLog),
  ))
}

export function getFiber(sql: Sql.SqlClient, fiberId: string) {
  return noTrace(Effect.map(
    sql<FiberRow>`SELECT * FROM Fiber WHERE id = ${fiberId}`,
    (rows) => rows.length > 0 ? rows[0] : undefined,
  ))
}

export function getParentChain(sql: Sql.SqlClient, fiberId: string) {
  return noTrace(Effect.gen(function* () {
    const chain: Array<string> = []
    const visited = new Set<string>()
    let current = fiberId
    while (true) {
      const rows = yield* sql<FiberRow>`SELECT * FROM Fiber WHERE id = ${current}`
      if (rows.length === 0 || !rows[0].parentId) break
      const parentId = rows[0].parentId
      if (visited.has(parentId)) break
      chain.push(parentId)
      visited.add(parentId)
      current = parentId
    }
    return chain.reverse()
  }))
}

export function getFiberContext(sql: Sql.SqlClient, fiberId: string) {
  return noTrace(Effect.map(
    sql<FiberRow>`SELECT * FROM Fiber WHERE id = ${fiberId}`,
    (rows): FiberContext | undefined =>
      rows.length > 0
        ? {
            spanName: rows[0].spanName ?? undefined,
            traceId: rows[0].traceId ?? undefined,
            annotations: JSON.parse(rows[0].annotations),
          }
        : undefined,
  ))
}
