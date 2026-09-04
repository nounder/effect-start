import * as test from "bun:test"
import { SqliteClient } from "effect-start/bun"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Queue from "effect/Queue"
import type * as Sql from "effect/unstable/sql/SqlClient"
import * as NFs from "node:fs"
import * as NPath from "node:path"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as OpenTelemetry from "effect-start/studio/internal/OpenTelemetry"
import * as Studio from "effect-start/studio/Studio"
import * as StudioStore from "effect-start/studio/StudioStore"

/**
 * Fixture captured by proxying real OTLP exporters into the studio ingest
 * endpoints: a Python service (opentelemetry-sdk 1.44, protobuf) and a Node
 * service (@opentelemetry/sdk-* 0.221/2.10, JSON). Each line is one recorded
 * HTTP request, replayed here byte for byte.
 */
type Capture = {
  readonly seq: number
  readonly path: string
  readonly requestHeaders: Record<string, string>
  readonly requestBodyBase64: string
  readonly status: number
}

const signals = ["traces", "logs", "metrics"] as const

type Signal = typeof signals[number]

const captures: ReadonlyArray<Capture> = NFs
  .readFileSync(NPath.join(import.meta.dir, "../../../static/OtelCapture/Traffic.ndjson"), "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => JSON.parse(line) as Capture)

function signalOf(capture: Capture): Signal {
  const signal = signals.find((item) => capture.path === `/v1/${item}`)
  if (!signal) throw new Error(`Unexpected capture path ${capture.path}`)
  return signal
}

function bodyOf(capture: Capture): Uint8Array<ArrayBuffer> {
  return Uint8Array.fromBase64(capture.requestBodyBase64) as Uint8Array<ArrayBuffer>
}

function capturesFor(signal: Signal, contentType: string): ReadonlyArray<Capture> {
  return captures.filter((capture) =>
    signalOf(capture) === signal && capture.requestHeaders["content-type"] === contentType
  )
}

const studioLayer = Layer.effect(
  Studio.Studio,
  Effect.gen(function*() {
    return {
      path: "/studio",
      auth: undefined,
      store: {
        events: yield* PubSub.unbounded<StudioStore.StudioEvent>(),
        writes: yield* Queue.unbounded<StudioStore.Write>(),
        spanCapacity: 1000,
        logCapacity: 1000,
        errorCapacity: 1000,
      },
    }
  }),
)

const sqlLayer = SqliteClient.layer({
  filename: ":memory:",
})

function run<A>(effect: Effect.Effect<A, unknown, Studio.Studio | Sql.SqlClient>) {
  return effect.pipe(
    Effect.provide(Layer.merge(studioLayer, sqlLayer)),
    Effect.runPromise,
  )
}

function replay(capture: Capture) {
  return Effect.gen(function*() {
    const signal = signalOf(capture)
    const context = yield* Effect.context<Studio.Studio | Sql.SqlClient>()
    const handler = RouteHttp.toWebHandlerWith(context)(
      Route.post(Route.handle(() => OpenTelemetry.handle(signal))),
    )
    const body = bodyOf(capture)
    return yield* Effect.promise(() =>
      Promise.resolve(
        handler(
          new Request(`http://localhost${capture.path}`, {
            method: "POST",
            // Replay the exporter's own content-type/encoding headers.
            headers: {
              "content-type": capture.requestHeaders["content-type"],
              ...capture.requestHeaders["content-encoding"] === undefined
                ? {}
                : { "content-encoding": capture.requestHeaders["content-encoding"] },
            },
            body,
          }),
        ),
      )
    )
  })
}

function replayAll(items: ReadonlyArray<Capture>) {
  return Effect.forEach(items, replay)
}

test.it("the fixture covers both wire formats across all three signals", () => {
  test
    .expect(captures.length)
    .toBeGreaterThan(0)
  test
    .expect(captures.map((capture) => capture.status))
    .toEqual(captures.map(() => 200))

  const matrix = signals.flatMap((signal) =>
    ["application/x-protobuf", "application/json"].map((contentType) => ({
      signal,
      contentType,
      count: capturesFor(signal, contentType).length,
    }))
  )

  test
    .expect(matrix.filter((cell) => cell.count === 0))
    .toEqual([])
})

test.it("persists every recorded exporter request without rejections", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase

    for (const capture of captures) {
      const response = yield* replay(capture)

      test
        .expect({ seq: capture.seq, status: response.status })
        .toEqual({ seq: capture.seq, status: 200 })

      // A partialSuccess body with a non-zero count means data was dropped.
      const contentType = capture.requestHeaders["content-type"]
      if (contentType === "application/json") {
        test
          .expect(yield* Effect.promise(() => response.json()))
          .toEqual({})
      } else {
        test
          .expect((yield* Effect.promise(() => response.arrayBuffer())).byteLength)
          .toBe(0)
      }
    }

    const spans = yield* StudioStore.allSpans()
    const logs = yield* StudioStore.allLogs()
    const metrics = yield* StudioStore.latestMetricsWithHistory(120_000)

    test
      .expect(spans.length)
      .toBeGreaterThan(0)
    test
      .expect(logs.length)
      .toBeGreaterThan(0)
    test
      .expect(metrics.length)
      .toBeGreaterThan(0)
  })))

test.it("reconstructs Python protobuf spans with parent links and events", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    yield* replayAll(capturesFor("traces", "application/x-protobuf"))

    const spans = yield* StudioStore.allSpans()
    const byName = (name: string) => spans.filter((span) => span.name === name)

    test
      .expect(spans.every((span) => span.resource?.attributes["service.name"] === "py-checkout"))
      .toBe(true)
    test
      .expect(spans.every((span) => /^[0-9a-f]{32}$/.test(span.traceId)))
      .toBe(true)
    test
      .expect(spans.every((span) => /^[0-9a-f]{16}$/.test(span.spanId)))
      .toBe(true)

    const orders = byName("POST /orders")

    test
      .expect(orders.length)
      .toBe(3)
    test
      .expect(orders.every((span) => span.kind === "server"))
      .toBe(true)
    test
      .expect(orders.every((span) => span.parentSpanId === undefined))
      .toBe(true)
    test
      .expect(orders.every((span) => (span.durationMs ?? 0) > 0))
      .toBe(true)
    test
      .expect(orders.every((span) => span.attributes["http.request.method"] === "POST"))
      .toBe(true)

    // Children resolve to a parent captured in the same batch.
    const spanIds = new Set(spans.map((span) => span.spanId))
    const children = spans.filter((span) => span.parentSpanId !== undefined)

    test
      .expect(children.length)
      .toBeGreaterThan(0)
    test
      .expect(children.filter((span) => !spanIds.has(span.parentSpanId!)))
      .toEqual([])

    const charge = byName("charge-card")

    test
      .expect(charge.length)
      .toBe(3)
    test
      .expect(charge.every((span) => span.kind === "client"))
      .toBe(true)
    test
      .expect(charge.flatMap((span) => span.events.map((event) => event.name)))
      .toContain("gateway.request")

    // The 980.00 order is declined, and the SDK records the exception as an event.
    const declined = charge.find((span) => span.status === "error")

    test
      .expect(declined)
      .toBeDefined()
    // The Python SDK prefixes the exception type onto the status description.
    test
      .expect(declined?.attributes["otel.status.message"])
      .toBe("ValueError: card declined")
    test
      .expect(declined?.events.map((event) => event.name))
      .toContain("exception")

    const rejectedOrder = orders.find((span) => span.status === "error")

    test
      .expect(rejectedOrder?.attributes["http.response.status_code"])
      .toBe(402)
    test
      .expect(orders.filter((span) => span.attributes["http.response.status_code"] === 201))
      .toHaveLength(2)
  })))

test.it("reconstructs JavaScript JSON spans with scope and status", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    yield* replayAll(capturesFor("traces", "application/json"))

    const spans = yield* StudioStore.allSpans()

    test
      .expect(spans.every((span) => span.resource?.attributes["service.name"] === "js-storefront"))
      .toBe(true)
    test
      .expect(spans.every((span) =>
        span.instrumentationScope?.name === "js.storefront.instrumentation"
        && span.instrumentationScope?.version === "1.2.0"
      ))
      .toBe(true)

    const renders = spans.filter((span) => span.name.startsWith("GET "))

    test
      .expect(renders.map((span) => span.name).sort())
      .toEqual(["GET /", "GET /checkout", "GET /products"])
    test
      .expect(renders.every((span) => span.kind === "server"))
      .toBe(true)
    test
      .expect(renders.every((span) => span.attributes["user.tier"] === "gold"))
      .toBe(true)

    const failed = renders.find((span) => span.name === "GET /checkout")

    test
      .expect(failed?.status)
      .toBe("error")
    test
      .expect(failed?.attributes["otel.status.message"])
      .toBe("render failed")
    test
      .expect(failed?.attributes["http.response.status_code"])
      .toBe(500)
    test
      .expect(failed?.events.map((event) => event.name))
      .toContain("exception")

    const ok = renders.filter((span) => span.name !== "GET /checkout")

    test
      .expect(ok.every((span) => span.status === "ok"))
      .toBe(true)
    test
      .expect(ok.every((span) => span.attributes["http.response.status_code"] === 200))
      .toBe(true)

    const queries = spans.filter((span) => span.name === "db.query products")

    test
      .expect(queries)
      .toHaveLength(3)
    test
      .expect(queries.every((span) => span.kind === "client"))
      .toBe(true)
    test
      .expect(queries.every((span) => span.attributes["db.system"] === "postgresql"))
      .toBe(true)
    test
      .expect(queries.every((span) => span.attributes["db.rows_affected"] === 20))
      .toBe(true)
    test
      .expect(queries.flatMap((span) => span.events.map((event) => event.name)))
      .toEqual(["rows.fetched", "rows.fetched", "rows.fetched"])
  })))

test.it("maps exporter severities onto studio log levels", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    yield* replayAll(captures.filter((capture) => signalOf(capture) === "logs"))

    const logs = yield* StudioStore.allLogs()
    const services = new Set(
      logs.map((log) => log.resource?.attributes["service.name"]),
    )

    test
      .expect(services)
      .toEqual(new Set(["py-checkout", "js-storefront"]))
    test
      .expect(logs.every((log) => log.message !== ""))
      .toBe(true)
    test
      .expect(logs.every((log) => Number.isFinite(log.timestamp) && log.timestamp > 0))
      .toBe(true)

    // Python: logging.error -> severityNumber 17, logging.warning -> 13.
    const declined = logs.find((log) => log.message.includes("payment declined"))

    test
      .expect(declined?.level)
      .toBe("ERROR")
    test
      .expect(declined?.annotations["otel.log.severity_number"])
      .toBe(17)

    const startup = logs.find((log) => log.message.includes("py-checkout starting up"))

    test
      .expect(startup?.level)
      .toBe("WARNING")

    const charged = logs.find((log) => log.message.startsWith("charged "))

    test
      .expect(charged?.level)
      .toBe("INFO")

    const validating = logs.find((log) => log.message.includes("validating order"))

    test
      .expect(validating?.level)
      .toBe("DEBUG")

    // JavaScript: logger.emit with explicit severityNumber.
    const booting = logs.find((log) => log.message === "js-storefront booting")

    test
      .expect(booting?.level)
      .toBe("WARNING")
    test
      .expect(booting?.annotations["otel.log.severity_text"])
      .toBe("WARN")

    const rendering = logs.filter((log) => log.message.startsWith("rendering "))

    test
      .expect(rendering)
      .toHaveLength(3)
    test
      .expect(rendering.every((log) => log.level === "INFO"))
      .toBe(true)

    const template = logs.find((log) => log.message.includes("template missing"))

    test
      .expect(template?.level)
      .toBe("ERROR")
    test
      .expect(typeof template?.cause)
      .toBe("string")
  })))

test.it("correlates log records with the traces that produced them", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    yield* replayAll(captures.filter((capture) => signalOf(capture) !== "metrics"))

    const spans = yield* StudioStore.allSpans()
    const logs = yield* StudioStore.allLogs()
    const traceIds = new Set(spans.map((span) => span.traceId))

    const correlated = logs.filter((log) => typeof log.annotations["otel.trace_id"] === "string")

    test
      .expect(correlated.length)
      .toBeGreaterThan(0)

    // Every trace id carried on a log record belongs to an ingested span, and
    // the fiber id is derived from it so the studio can group them.
    for (const log of correlated) {
      const traceId = log.annotations["otel.trace_id"] as string

      test
        .expect(traceIds.has(traceId))
        .toBe(true)
      test
        .expect(log.fiberId)
        .toBe(`otlp:${traceId}`)
    }
  })))

test.it("persists counters, gauges and histograms from both exporters", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    yield* replayAll(captures.filter((capture) => signalOf(capture) === "metrics"))

    const metrics = yield* StudioStore.latestMetricsWithHistory(120_000)

    // A series is keyed by name *and* tags, so one instrument can yield several.
    const seriesFor = (name: string) =>
      metrics.filter((series) => series.latest.name === name).map((series) => series.latest)

    test
      .expect([...new Set(metrics.map((series) => series.latest.name))].sort())
      .toEqual([
        "cart.value",
        "checkout.latency",
        "orders.submitted",
        "page.render",
        "page.views",
        "sessions.active",
      ])

    // Monotonic cumulative sums land as counters.
    test
      .expect(seriesFor("orders.submitted").map((point) => point.type))
      .toEqual(seriesFor("orders.submitted").map(() => "counter"))
    test
      .expect(seriesFor("page.views").map((point) => point.type))
      .toEqual(seriesFor("page.views").map(() => "counter"))
    test
      .expect(seriesFor("checkout.latency").map((point) => point.type))
      .toEqual(["histogram"])
    test
      .expect(seriesFor("page.render").map((point) => point.type))
      .toEqual(["histogram", "histogram", "histogram"])

    // orders.submitted is split by outcome: 2 accepted, 1 rejected. The Python
    // reader pushed cumulative state twice, so each outcome appears per batch.
    test
      .expect([...new Set(seriesFor("orders.submitted").map((point) => point.value))].sort())
      .toEqual([1, 2])

    type Histogram = {
      count: number
      sum: number
      min: number
      max: number
      buckets: ReadonlyArray<number>
      explicitBounds: ReadonlyArray<number>
    }

    // Python records all three checkout latencies under one route tag.
    const latency = seriesFor("checkout.latency")[0].value as Histogram

    test
      .expect(latency.count)
      .toBe(3)
    test
      .expect(latency.sum)
      .toBeGreaterThan(0)
    test
      .expect(latency.min)
      .toBeLessThanOrEqual(latency.max)
    test
      .expect(latency.buckets.length)
      .toBe(latency.explicitBounds.length + 1)
    test
      .expect(latency.buckets.reduce((total, count) => total + count, 0))
      .toBe(latency.count)

    // JavaScript tags each render by path, so each series holds a single sample.
    const renders = seriesFor("page.render").map((point) => point.value as Histogram)

    test
      .expect(renders.map((render) => render.count))
      .toEqual([1, 1, 1])
    test
      .expect(renders.every((render) => render.sum > 0))
      .toBe(true)
    test
      .expect(renders.every((render) => render.buckets.reduce((total, count) => total + count, 0) === render.count))
      .toBe(true)
  })))

/**
 * Proto3 omits `is_monotonic` from the wire when it is false, which is how both
 * SDKs encode an up/down counter. The absent field must read as non-monotonic,
 * not as undefined-and-therefore-monotonic.
 */
test.it("classifies non-monotonic protobuf sums as gauges", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    yield* replayAll(capturesFor("metrics", "application/x-protobuf"))

    const cartValue = (yield* StudioStore.latestMetricsWithHistory(120_000))
      .find((series) => series.latest.name === "cart.value")

    // Python up_down_counter: is_monotonic absent from the wire.
    test
      .expect(cartValue?.latest.type)
      .toBe("gauge")
  })))

test.it("classifies an explicit JSON isMonotonic:false sum as a gauge", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    yield* replayAll(capturesFor("metrics", "application/json"))

    const sessions = (yield* StudioStore.latestMetricsWithHistory(120_000))
      .find((series) => series.latest.name === "sessions.active")

    test
      .expect(sessions?.latest.type)
      .toBe("gauge")
    // 12 sessions opened, 3 closed.
    test
      .expect(sessions?.latest.value)
      .toBe(9)
  })))

test.it("keeps point attributes as tags and resource identity off the tag list", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    yield* replayAll(captures.filter((capture) => signalOf(capture) === "metrics"))

    const metrics = yield* StudioStore.latestMetricsWithHistory(120_000)
    const tagsOf = (name: string) => metrics.find((series) => series.latest.name === name)?.latest.tags ?? []

    test
      .expect(tagsOf("orders.submitted"))
      .toEqual(test.expect.arrayContaining([
        { key: "region", value: "eu" },
        { key: "otel.metric.unit", value: "{order}" },
      ]))
    test
      .expect(tagsOf("orders.submitted").map((tag) => tag.value))
      .toContain("accepted")
    test
      .expect(tagsOf("page.views"))
      .toEqual(test.expect.arrayContaining([
        { key: "outcome", value: "ok" },
      ]))
    test
      .expect(tagsOf("checkout.latency"))
      .toEqual(test.expect.arrayContaining([
        { key: "route", value: "/orders" },
        { key: "otel.metric.unit", value: "ms" },
      ]))

    // Resource and scope identity live on their own fields, never as tags.
    for (const series of metrics) {
      test
        .expect(series.latest.tags.some((tag) => tag.key === "service.name"))
        .toBe(false)
      test
        .expect(series.latest.tags.some((tag) => tag.key.startsWith("otel.scope.")))
        .toBe(false)
      test
        .expect(typeof series.latest.resource?.attributes["service.name"])
        .toBe("string")
    }

    test
      .expect(
        new Set(metrics.map((series) => series.latest.resource?.attributes["service.name"])),
      )
      .toEqual(new Set(["py-checkout", "js-storefront"]))
  })))

test.it("carries resource attributes through every signal", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    yield* replayAll(captures)

    const spans = yield* StudioStore.allSpans()
    const logs = yield* StudioStore.allLogs()
    const metrics = yield* StudioStore.latestMetricsWithHistory(120_000)

    const resources = [
      ...spans.map((span) => span.resource),
      ...logs.map((log) => log.resource),
      ...metrics.map((series) => series.latest.resource),
    ]

    test
      .expect(resources.length)
      .toBeGreaterThan(0)
    test
      .expect(resources.every((resource) => resource?.attributes["deployment.environment"] === "lab"))
      .toBe(true)
    test
      .expect(
        new Set(resources.map((resource) => resource?.attributes["service.version"])),
      )
      .toEqual(new Set(["2.1.0", "4.0.1"]))
  })))

test.it("replaying the same batch twice does not duplicate spans", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase

    const batch = capturesFor("traces", "application/x-protobuf")

    yield* replayAll(batch)

    const first = yield* StudioStore.allSpans()

    yield* replayAll(batch)

    const second = yield* StudioStore.allSpans()

    test
      .expect(first.length)
      .toBeGreaterThan(0)
    test
      .expect(second.map((span) => span.spanId).sort())
      .toEqual(first.map((span) => span.spanId).sort())
  })))

test.it("ingests gzip-compressed recordings of the same payloads", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase

    for (const capture of captures) {
      const signal = signalOf(capture)
      const context = yield* Effect.context<Studio.Studio | Sql.SqlClient>()
      const handler = RouteHttp.toWebHandlerWith(context)(
        Route.post(Route.handle(() => OpenTelemetry.handle(signal))),
      )
      const gzipped = Bun.gzipSync(bodyOf(capture))
      const response = yield* Effect.promise(() =>
        Promise.resolve(
          handler(
            new Request(`http://localhost${capture.path}`, {
              method: "POST",
              headers: {
                "content-type": capture.requestHeaders["content-type"],
                "content-encoding": "gzip",
              },
              body: gzipped,
            }),
          ),
        )
      )

      test
        .expect({ seq: capture.seq, status: response.status })
        .toEqual({ seq: capture.seq, status: 200 })
    }

    test
      .expect((yield* StudioStore.allSpans()).length)
      .toBeGreaterThan(0)
    test
      .expect((yield* StudioStore.allLogs()).length)
      .toBeGreaterThan(0)
    test
      .expect((yield* StudioStore.latestMetricsWithHistory(120_000)).length)
      .toBeGreaterThan(0)
  })))
