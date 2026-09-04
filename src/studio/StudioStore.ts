import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import type * as PubSub from "effect/PubSub"
import * as Queue from "effect/Queue"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import type * as SqlError from "effect/unstable/sql/SqlError"
import type * as Tracing from "../internal/Tracing.ts"
import * as StudioContext from "./internal/StudioContext.ts"

export const studioTraceAttribute = "effect-start.studio.internal"

export function isStudioTrace(spans: Array<Tracing.Span>): boolean {
  return spans.some((span) => span.attributes[studioTraceAttribute] === true)
}

export function filterOutStudioSpans(
  spans: Array<Tracing.Span>,
): Array<Tracing.Span> {
  const hiddenTraceIds = new Set<string>()

  for (const span of spans) {
    if (span.attributes[studioTraceAttribute] === true) {
      hiddenTraceIds.add(span.traceId)
    }
  }

  return spans.filter((span) => !hiddenTraceIds.has(span.traceId))
}

export interface LogEntry {
  readonly id: bigint
  readonly timestamp: number
  readonly level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "FATAL"
  readonly message: string
  readonly fiberId: string
  readonly cause: string | undefined
  readonly spans: Array<string>
  readonly annotations: Record<string, unknown>
  readonly resource?: Tracing.Resource
  readonly instrumentationScope?: Tracing.InstrumentationScope
}

export const STUDIO_METRIC_PREFIX = "effect-start."
export const PROCESS_METRIC_PREFIX = STUDIO_METRIC_PREFIX + "process."

export interface ProcessSeries {
  readonly latest: Record<string, number>
  readonly history: Record<
    string,
    ReadonlyArray<{
      readonly timestamp: number
      readonly value: number
    }>
  >
}

export interface ErrorDetail {
  readonly kind: "fail" | "die"
  readonly tag: string | undefined
  readonly message: string
  readonly properties: Record<string, unknown>
  readonly span: string | undefined
}

export interface ErrorEntry {
  readonly id: bigint
  readonly fiberId: string
  readonly interrupted: boolean
  readonly prettyPrint: string
  readonly details: Array<ErrorDetail>
}

export interface MetricSnapshot {
  readonly name: string
  readonly type: "counter" | "gauge" | "histogram" | "summary" | "frequency"
  readonly value: unknown
  readonly tags: ReadonlyArray<{ key: string; value: string }>
  readonly timestamp: number
  readonly resource?: Tracing.Resource
  readonly instrumentationScope?: Tracing.InstrumentationScope
}

export type StudioEvent =
  | { readonly _tag: "SpanStart"; readonly span: Tracing.Span }
  | { readonly _tag: "SpanEnd"; readonly span: Tracing.Span }
  | { readonly _tag: "TraceStart"; readonly traceId: string }
  | { readonly _tag: "TraceEnd"; readonly traceId: string }
  | { readonly _tag: "Log"; readonly log: LogEntry }
  | { readonly _tag: "Error"; readonly error: ErrorEntry }
  | {
    readonly _tag: "MetricsSnapshot"
    readonly metrics: Array<MetricSnapshot>
  }
  | { readonly _tag: "ProcessSnapshot" }

export interface FiberContext {
  readonly spanName: string | undefined
  readonly traceId: string | undefined
  readonly annotations: Record<string, unknown>
}

export type Write = Effect.Effect<
  unknown,
  SqlError.SqlError,
  SqlClient.SqlClient
>

export interface State {
  readonly events: PubSub.PubSub<StudioEvent>
  readonly writes: Queue.Queue<Write>
  readonly spanCapacity: number
  readonly logCapacity: number
  readonly errorCapacity: number
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS Span (
    spanId BLOB NOT NULL,
    traceId BLOB NOT NULL,
    fiberId TEXT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    parentSpanId BLOB,
    startTime TEXT NOT NULL,
    endTime TEXT,
    durationMs REAL,
    status TEXT NOT NULL,
    attributes TEXT NOT NULL,
    events TEXT NOT NULL,
    resource TEXT,
    instrumentationScope TEXT,
    PRIMARY KEY (traceId, spanId)
  )`,
  `CREATE TABLE IF NOT EXISTS Log (
    id INTEGER PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    fiberId TEXT NOT NULL,
    cause TEXT,
    spans TEXT NOT NULL,
    annotations TEXT NOT NULL,
    resource TEXT,
    instrumentationScope TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS Error (
    id INTEGER PRIMARY KEY,
    fiberId TEXT NOT NULL,
    interrupted INTEGER NOT NULL,
    prettyPrint TEXT NOT NULL,
    details TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS Fiber (
    id TEXT PRIMARY KEY,
    parentId TEXT,
    spanName TEXT,
    traceId INTEGER,
    annotations TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS MetricSample (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    tags TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    value TEXT NOT NULL,
    resource TEXT,
    instrumentationScope TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_MetricSample_name_tags_timestamp
    ON MetricSample(name, tags, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_MetricSample_timestamp
    ON MetricSample(timestamp)`,
]

function canonicalTags(
  tags: ReadonlyArray<{ key: string; value: string }>,
): string {
  const sorted = [...tags].sort((a, b) => a.key.localeCompare(b.key))
  return JSON.stringify(sorted)
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => item === undefined ? "null" : canonicalJson(item)).join(",")}]`
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${
      Object
        .keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
        .join(",")
    }}`
  }
  return JSON.stringify(value) ?? "null"
}

function encodeTelemetryId(id: string): string | bigint | Uint8Array {
  if ((id.length === 16 || id.length === 32) && /^[0-9a-f]+$/i.test(id)) {
    return Uint8Array.from(id.match(/../g)!, (byte) => Number.parseInt(byte, 16))
  }
  if (/^[0-9]{1,19}$/.test(id)) {
    const value = BigInt(id)
    if (value <= 0x7fffffffffffffffn) return value
  }
  return id
}

function decodeTelemetryId(id: string | bigint | Uint8Array): string {
  if (id instanceof Uint8Array) {
    return Array.from(id, (byte) => byte.toString(16).padStart(2, "0")).join("")
  }
  return String(id)
}

export const setupDatabase = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient
  for (const ddl of DDL) {
    yield* sql.unsafe(ddl)
  }
})

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
  if (typeof value === "string" && value.startsWith("__bigint__")) {
    return BigInt(value.slice(10))
  }
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

export interface SpanRow {
  readonly spanId: string | bigint | Uint8Array
  readonly traceId: string | bigint | Uint8Array
  readonly fiberId: string | null
  readonly name: string
  readonly kind: string
  readonly parentSpanId: string | bigint | Uint8Array | null
  readonly startTime: string
  readonly endTime: string | null
  readonly durationMs: number | null
  readonly status: string
  readonly attributes: string
  readonly events: string
  readonly resource: string | null
  readonly instrumentationScope: string | null
}

export interface LogRow {
  readonly id: bigint
  readonly timestamp: bigint
  readonly level: string
  readonly message: string
  readonly fiberId: string
  readonly cause: string | null
  readonly spans: string
  readonly annotations: string
  readonly resource: string | null
  readonly instrumentationScope: string | null
}

export interface ErrorRow {
  readonly id: bigint
  readonly fiberId: string
  readonly interrupted: bigint
  readonly prettyPrint: string
  readonly details: string
}

export interface FiberRow {
  readonly id: string
  readonly parentId: string | null
  readonly spanName: string | null
  readonly traceId: bigint | null
  readonly annotations: string
}

interface MetricSampleRow {
  readonly id: bigint
  readonly name: string
  readonly type: string
  readonly tags: string
  readonly timestamp: bigint
  readonly value: string
  readonly resource: string | null
  readonly instrumentationScope: string | null
}

function deserializeMetric(row: MetricSampleRow): MetricSnapshot {
  return {
    name: row.name,
    type: row.type as MetricSnapshot["type"],
    value: JSON.parse(row.value),
    tags: JSON.parse(row.tags),
    timestamp: Number(row.timestamp),
    resource: row.resource ? JSON.parse(row.resource) : undefined,
    instrumentationScope: row.instrumentationScope ? JSON.parse(row.instrumentationScope) : undefined,
  }
}

// TODO: do we need to dserialize? why not store it directly?
export function deserializeSpan(row: SpanRow): Tracing.Span {
  const events = reviveBigint(JSON.parse(row.events)) as Tracing.Span["events"]
  return {
    spanId: decodeTelemetryId(row.spanId),
    traceId: decodeTelemetryId(row.traceId),
    fiberId: row.fiberId ?? undefined,
    name: row.name,
    kind: row.kind,
    parentSpanId: row.parentSpanId != null
      ? decodeTelemetryId(row.parentSpanId)
      : undefined,
    startTime: BigInt(row.startTime),
    endTime: row.endTime ? BigInt(row.endTime) : undefined,
    durationMs: row.durationMs ?? undefined,
    status: row.status as Tracing.Span["status"],
    attributes: JSON.parse(row.attributes),
    events,
    resource: row.resource ? JSON.parse(row.resource) : undefined,
    instrumentationScope: row.instrumentationScope ? JSON.parse(row.instrumentationScope) : undefined,
  }
}

export function deserializeLog(row: LogRow): LogEntry {
  return {
    id: row.id,
    timestamp: Number(row.timestamp),
    level: row.level as LogEntry["level"],
    message: row.message,
    fiberId: row.fiberId,
    cause: row.cause ?? undefined,
    spans: JSON.parse(row.spans),
    annotations: JSON.parse(row.annotations),
    resource: row.resource ? JSON.parse(row.resource) : undefined,
    instrumentationScope: row.instrumentationScope ? JSON.parse(row.instrumentationScope) : undefined,
  }
}

export function deserializeError(row: ErrorRow): ErrorEntry {
  return {
    id: row.id,
    fiberId: row.fiberId,
    interrupted: row.interrupted === 1n,
    prettyPrint: row.prettyPrint,
    details: JSON.parse(row.details),
  }
}

// TODO:
const withSql = <A, E>(
  f: (sql: SqlClient.SqlClient) => Effect.Effect<A, E>,
): Effect.Effect<A, E, SqlClient.SqlClient> => Effect.flatMap(SqlClient.SqlClient, f)

export function insertSpan(span: Tracing.Span) {
  return withSql(
    (sql) =>
      sql`INSERT OR REPLACE INTO Span ${
        sql.insert({
          spanId: encodeTelemetryId(span.spanId),
          traceId: encodeTelemetryId(span.traceId),
          fiberId: span.fiberId ?? null,
          name: span.name,
          kind: span.kind,
          parentSpanId: span.parentSpanId ? encodeTelemetryId(span.parentSpanId) : null,
          startTime: span.startTime.toString(),
          endTime: span.endTime?.toString() ?? null,
          durationMs: span.durationMs ?? null,
          status: span.status,
          attributes: JSON.stringify(span.attributes),
          events: JSON.stringify(serializeBigint(span.events)),
          resource: span.resource ? JSON.stringify(span.resource) : null,
          instrumentationScope: span.instrumentationScope ? JSON.stringify(span.instrumentationScope) : null,
        })
      }`,
  )
}

export function updateSpan(span: Tracing.Span) {
  return withSql(
    (sql) =>
      sql`UPDATE Span SET
      endTime = ${span.endTime?.toString() ?? null},
      durationMs = ${span.durationMs ?? null},
      status = ${span.status},
      attributes = ${JSON.stringify(span.attributes)},
      events = ${JSON.stringify(serializeBigint(span.events))},
      resource = ${span.resource ? JSON.stringify(span.resource) : null},
      instrumentationScope = ${span.instrumentationScope ? JSON.stringify(span.instrumentationScope) : null}
      WHERE traceId = ${encodeTelemetryId(span.traceId)} AND spanId = ${encodeTelemetryId(span.spanId)}`,
  )
}

export function insertLog(log: LogEntry) {
  return withSql(
    (sql) =>
      sql`INSERT INTO Log ${
        sql.insert({
          id: log.id,
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
          fiberId: log.fiberId,
          cause: log.cause ?? null,
          spans: JSON.stringify(log.spans),
          annotations: JSON.stringify(log.annotations),
          resource: log.resource ? JSON.stringify(log.resource) : null,
          instrumentationScope: log.instrumentationScope ? JSON.stringify(log.instrumentationScope) : null,
        })
      }`,
  )
}

export function insertError(error: ErrorEntry) {
  return withSql(
    (sql) =>
      sql`INSERT INTO Error ${
        sql.insert({
          id: error.id,
          fiberId: error.fiberId,
          interrupted: error.interrupted ? 1 : 0,
          prettyPrint: error.prettyPrint,
          details: JSON.stringify(error.details),
        })
      }`,
  )
}

export function insertMetrics(
  snapshots: ReadonlyArray<MetricSnapshot>,
) {
  if (snapshots.length === 0) return Effect.void
  return withSql((sql) =>
    sql`INSERT INTO MetricSample ${
      sql.insert(
        snapshots.map((s) => ({
          name: s.name,
          type: s.type,
          tags: canonicalTags(s.tags),
          timestamp: s.timestamp,
          value: JSON.stringify(s.value),
          resource: s.resource ? canonicalJson(s.resource) : null,
          instrumentationScope: s.instrumentationScope ? canonicalJson(s.instrumentationScope) : null,
        })),
      )
    }`
  )
}

export function upsertFiber(
  id: string,
  parentId: string | undefined,
  spanName: string | undefined,
  traceId: bigint | undefined,
  annotations: Record<string, unknown>,
) {
  return withSql(
    (sql) =>
      sql`INSERT OR REPLACE INTO Fiber ${
        sql.insert({
          id,
          parentId: parentId ?? null,
          spanName: spanName ?? null,
          traceId: traceId ?? null,
          annotations: JSON.stringify(annotations),
        })
      }`,
  )
}

// Ids are snowflakes aliased to rowid, so time order is rowid order: keeping
// the newest rows is a single delete below the (capacity + 1)-th largest id.
// When the table holds at most capacity rows, the subquery yields NULL and
// nothing matches.
export function evict(
  table: "Log" | "Error" | "MetricSample",
  capacity: number,
) {
  return withSql((sql) =>
    sql`DELETE FROM ${sql(table)} WHERE rowid <= (
      SELECT rowid FROM ${sql(table)}
      ORDER BY rowid DESC LIMIT 1 OFFSET ${capacity}
    )`
  )
}

export function evictSpans(capacity: number) {
  return withSql((sql) =>
    sql`DELETE FROM Span WHERE status != 'started' AND rowid <= (
      SELECT rowid FROM Span
      ORDER BY rowid DESC LIMIT 1 OFFSET ${capacity}
    )`
  )
}

// Tracer hooks and loggers are synchronous callbacks invoked by the runtime,
// so they cannot yield the insert effects themselves. They enqueue
// writes here, and a fiber forked in the Studio layer drains them in order.
export function runWrite(store: State, effect: Write) {
  Queue.offerUnsafe(store.writes, effect)
}

// Events are published synchronously while writes are queued, so readers
// reacting to an event must flush before querying to observe its data.
export function flushWrites() {
  return Effect.gen(function*() {
    const studio = yield* StudioContext.Studio
    const done = yield* Deferred.make<void>()
    yield* Queue.offer(studio.store.writes, Deferred.succeed(done, undefined))
    yield* Deferred.await(done)
  })
}

const noTrace = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => Effect.withTracerEnabled(effect, false)

export function allSpans() {
  return noTrace(
    withSql((sql) =>
      Effect.map(
        sql<SpanRow>`SELECT * FROM Span ORDER BY rowid`,
        (rows) => rows.map(deserializeSpan),
      )
    ),
  )
}

export function allLogs() {
  return noTrace(
    withSql((sql) =>
      Effect.map(
        sql<LogRow>`SELECT * FROM Log ORDER BY rowid`,
        (rows) => rows.map(deserializeLog),
      )
    ),
  )
}

export function spansByTraceId(traceId: string) {
  return noTrace(
    withSql((sql) =>
      Effect.map(
        sql<
          SpanRow
        >`SELECT * FROM Span WHERE traceId = ${encodeTelemetryId(traceId)} ORDER BY rowid`,
        (rows) => rows.map(deserializeSpan),
      )
    ),
  )
}

export function traceContainsFiber(traceId: string, fiberId: string) {
  return noTrace(withSql((sql) =>
    Effect.map(
      sql`SELECT 1 FROM Span WHERE traceId = ${encodeTelemetryId(traceId)} AND fiberId = ${fiberId} LIMIT 1`,
      (rows) => rows.length > 0,
    )
  ))
}

export function logsByTraceId(traceId: string) {
  return noTrace(withSql((sql) =>
    Effect.map(
      sql<LogRow>`SELECT * FROM Log WHERE fiberId IN (
        SELECT DISTINCT fiberId FROM Span
        WHERE traceId = ${encodeTelemetryId(traceId)} AND fiberId IS NOT NULL
      ) ORDER BY rowid`,
      (rows) => rows.map(deserializeLog),
    )
  ))
}

export interface MetricSeries {
  readonly latest: MetricSnapshot
  readonly history: ReadonlyArray<MetricSnapshot>
}

export function latestMetricsWithHistory(historyMs: number) {
  return noTrace(
    withSql((sql) =>
      Effect.gen(function*() {
        const rows = yield* sql<MetricSampleRow>`
          SELECT * FROM MetricSample
          WHERE timestamp >= (
            SELECT COALESCE(MAX(timestamp), 0) - ${historyMs} FROM MetricSample
          )
            AND name NOT LIKE ${STUDIO_METRIC_PREFIX + "%"}
          ORDER BY name, tags, timestamp
        `
        const grouped = new Map<string, Array<MetricSnapshot>>()
        for (const row of rows) {
          const key = `${row.name} ${row.tags} ${row.resource ?? ""} ${row.instrumentationScope ?? ""}`
          let arr = grouped.get(key)
          if (!arr) {
            arr = []
            grouped.set(key, arr)
          }
          arr.push(deserializeMetric(row))
        }
        const series: Array<MetricSeries> = []
        for (const history of grouped.values()) {
          if (history.length === 0) continue
          series.push({ latest: history[history.length - 1], history })
        }
        return series
      })
    ),
  )
}

export function processSeries(historyMs: number) {
  return noTrace(
    withSql((sql) =>
      Effect.gen(function*() {
        const rows = yield* sql<MetricSampleRow>`
          SELECT * FROM MetricSample
          WHERE name LIKE ${PROCESS_METRIC_PREFIX + "%"}
            AND timestamp >= (
              SELECT COALESCE(MAX(timestamp), 0) - ${historyMs} FROM MetricSample
              WHERE name LIKE ${PROCESS_METRIC_PREFIX + "%"}
            )
          ORDER BY name, timestamp
        `
        const history: Record<
          string,
          Array<{ timestamp: number; value: number }>
        > = {}
        const latest: Record<string, number> = {}
        for (const row of rows) {
          const key = row.name.slice(PROCESS_METRIC_PREFIX.length)
          const value = Number(JSON.parse(row.value))
          let arr = history[key]
          if (!arr) {
            arr = []
            history[key] = arr
          }
          arr.push({ timestamp: Number(row.timestamp), value })
          latest[key] = value
        }
        return { latest, history } satisfies ProcessSeries
      })
    ),
  )
}
