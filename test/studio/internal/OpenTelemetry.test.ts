import * as test from "bun:test"
import { SqliteClient } from "effect-start/bun"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PubSub from "effect/PubSub"
import * as Queue from "effect/Queue"
import type * as Sql from "effect/unstable/sql/SqlClient"
import * as Route from "effect-start/Route"
import * as RouteHttp from "effect-start/RouteHttp"
import * as OpenTelemetry from "effect-start/studio/internal/OpenTelemetry"
import * as Studio from "effect-start/studio/Studio"
import * as StudioStore from "effect-start/studio/StudioStore"

const traceId = "5b8efff798038103d269b633813fc60c"
const spanId = "eee19b7ec3c1b174"
const timestampNano = "1710000000000000000"

const studioLayer = Layer.effect(
  Studio.Studio,
  Effect.gen(function*() {
    return {
      path: "/studio",
      auth: undefined,
      store: {
        events: yield* PubSub.unbounded<StudioStore.StudioEvent>(),
        writes: yield* Queue.unbounded<StudioStore.Write>(),
        spanCapacity: 100,
        logCapacity: 100,
        errorCapacity: 100,
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

function request(signal: "traces" | "logs" | "metrics", body: BodyInit, headers: HeadersInit) {
  return Effect.gen(function*() {
    const context = yield* Effect.context<Studio.Studio | Sql.SqlClient>()
    const handler = RouteHttp.toWebHandlerWith(context)(
      Route.post(Route.handle(() => OpenTelemetry.handle(signal))),
    )
    return yield* Effect.promise(() =>
      Promise.resolve(
        handler(
          new Request(`http://localhost/v1/${signal}`, {
            method: "POST",
            headers,
            body,
          }),
        ),
      )
    )
  })
}

function concat(parts: ReadonlyArray<Uint8Array>): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  return bytes
}

function varint(value: bigint): Uint8Array {
  const bytes: Array<number> = []
  let remaining = value
  do {
    let byte = Number(remaining & 0x7fn)
    remaining >>= 7n
    if (remaining > 0n) byte |= 0x80
    bytes.push(byte)
  } while (remaining > 0n)
  return Uint8Array.from(bytes)
}

function fieldVarint(field: number, value: bigint): Uint8Array {
  return concat([varint(BigInt(field << 3)), varint(value)])
}

function fieldBytes(field: number, value: Uint8Array): Uint8Array {
  return concat([
    varint(BigInt((field << 3) | 2)),
    varint(BigInt(value.length)),
    value,
  ])
}

function fieldString(field: number, value: string): Uint8Array {
  return fieldBytes(field, new TextEncoder().encode(value))
}

function fieldFixed64(field: number, value: bigint): Uint8Array {
  const bytes = new Uint8Array(8)
  let remaining = value
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
  return concat([varint(BigInt((field << 3) | 1)), bytes])
}

function fieldDouble(field: number, value: number): Uint8Array {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setFloat64(0, value, true)
  return concat([varint(BigInt((field << 3) | 1)), bytes])
}

function keyValue(key: string, value: string): Uint8Array {
  return concat([
    fieldString(1, key),
    fieldBytes(2, fieldString(1, value)),
  ])
}

function resource(): Uint8Array {
  return fieldBytes(1, keyValue("service.name", "checkout"))
}

function scope(signal: Uint8Array): Uint8Array {
  return concat([
    fieldBytes(1, fieldString(1, "integration-test")),
    fieldBytes(2, signal),
  ])
}

function resourceEnvelope(signal: Uint8Array): Uint8Array {
  return fieldBytes(
    1,
    concat([
      fieldBytes(1, resource()),
      fieldBytes(2, scope(signal)),
    ]),
  )
}

function binaryTraceRequest(): Uint8Array {
  const status = fieldVarint(3, 2n)
  const span = concat([
    fieldBytes(1, Uint8Array.fromHex(traceId)),
    fieldBytes(2, Uint8Array.fromHex(spanId)),
    fieldString(5, "POST /orders"),
    fieldVarint(6, 2n),
    fieldFixed64(7, BigInt(timestampNano)),
    fieldFixed64(8, BigInt(timestampNano) + 5_000_000n),
    fieldBytes(9, keyValue("http.request.method", "POST")),
    fieldBytes(15, status),
  ])
  return resourceEnvelope(span)
}

function binaryLogRequest(): Uint8Array {
  const record = concat([
    fieldFixed64(1, BigInt(timestampNano)),
    fieldVarint(2, 17n),
    fieldString(3, "ERROR"),
    fieldBytes(5, fieldString(1, "payment failed")),
    fieldBytes(6, keyValue("exception.message", "declined")),
    fieldBytes(9, Uint8Array.fromHex(traceId)),
    fieldBytes(10, Uint8Array.fromHex(spanId)),
  ])
  return resourceEnvelope(record)
}

function binaryMetricRequest(): Uint8Array {
  const point = concat([
    fieldFixed64(3, BigInt(timestampNano)),
    fieldDouble(4, 7.5),
    fieldBytes(7, keyValue("region", "eu")),
    fieldVarint(8, 3n),
  ])
  const metric = concat([
    fieldString(1, "queue.depth"),
    fieldString(3, "{item}"),
    fieldBytes(5, fieldBytes(1, point)),
  ])
  return resourceEnvelope(metric)
}

const jsonTrace = {
  resourceSpans: [{
    resource: {
      attributes: [{ key: "service.name", value: { stringValue: "checkout" } }],
    },
    scopeSpans: [{
      scope: { name: "json-test", version: "1.0.0" },
      spans: [{
        traceId,
        spanId,
        name: "GET /cart",
        kind: 2,
        startTimeUnixNano: timestampNano,
        endTimeUnixNano: String(BigInt(timestampNano) + 10_000_000n),
        attributes: [{ key: "http.response.status_code", value: { intValue: "500" } }],
        events: [{
          timeUnixNano: timestampNano,
          name: "exception",
          attributes: [{ key: "exception.type", value: { stringValue: "Error" } }],
        }],
        status: { code: 2, message: "failed" },
      }],
    }],
  }],
}

const jsonLog = {
  resourceLogs: [{
    resource: {
      attributes: [{ key: "service.name", value: { stringValue: "checkout" } }],
    },
    scopeLogs: [{
      scope: { name: "json-test" },
      logRecords: [{
        timeUnixNano: timestampNano,
        severityNumber: 13,
        severityText: "WARN",
        body: { stringValue: "cart is almost full" },
        attributes: [{ key: "cart.items", value: { intValue: "99" } }],
        traceId,
        spanId,
      }],
    }],
  }],
}

const jsonMetrics = {
  resourceMetrics: [{
    resource: {
      attributes: [{ key: "service.name", value: { stringValue: "checkout" } }],
    },
    scopeMetrics: [{
      scope: { name: "json-test" },
      metrics: [{
        name: "cart.items",
        unit: "{item}",
        gauge: {
          dataPoints: [{
            attributes: [{ key: "region", value: { stringValue: "us" } }],
            startTimeUnixNano: String(BigInt(timestampNano) - 1_000_000n),
            timeUnixNano: timestampNano,
            asInt: "99",
            flags: 1,
            exemplars: [{
              filteredAttributes: [{ key: "sampled", value: { boolValue: true } }],
              timeUnixNano: timestampNano,
              asDouble: 98.5,
              spanId,
              traceId,
            }],
          }],
        },
      }, {
        name: "requests.total",
        sum: {
          aggregationTemporality: 2,
          isMonotonic: true,
          dataPoints: [{ timeUnixNano: timestampNano, asDouble: 12 }],
        },
      }, {
        name: "request.duration",
        histogram: {
          aggregationTemporality: 2,
          dataPoints: [{
            timeUnixNano: timestampNano,
            count: "2",
            sum: 6,
            bucketCounts: ["1", "1"],
            explicitBounds: [3],
            min: 2,
            max: 4,
          }],
        },
      }, {
        name: "payload.size",
        exponentialHistogram: {
          aggregationTemporality: 1,
          dataPoints: [{
            timeUnixNano: timestampNano,
            count: "2",
            sum: 6,
            scale: 1,
            zeroCount: "0",
            positive: { offset: 0, bucketCounts: ["1", "1"] },
            min: 2,
            max: 4,
          }],
        },
      }, {
        name: "response.size",
        summary: {
          dataPoints: [{
            timeUnixNano: timestampNano,
            count: "2",
            sum: 6,
            quantileValues: [
              { quantile: 0, value: 2 },
              { quantile: 0.5, value: 3 },
              { quantile: 1, value: 4 },
            ],
          }],
        },
      }],
    }],
  }],
}

test.it("ingests OTLP/HTTP JSON traces, logs, and gzip-compressed metrics", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase

    const traceResponse = yield* request("traces", JSON.stringify(jsonTrace), {
      "content-type": "application/json",
    })
    const logResponse = yield* request("logs", JSON.stringify(jsonLog), {
      "content-type": "application/json",
    })
    const metricResponse = yield* request("metrics", new Blob([Bun.gzipSync(JSON.stringify(jsonMetrics))]), {
      "content-type": "application/json",
      "content-encoding": "gzip",
    })

    test
      .expect(traceResponse.status)
      .toBe(200)

    const traceResponseJson = yield* Effect.promise(() => traceResponse.json())

    test
      .expect(traceResponseJson)
      .toEqual({})
    test
      .expect(logResponse.status)
      .toBe(200)
    test
      .expect(metricResponse.status)
      .toBe(200)

    const spans = yield* StudioStore.allSpans()
    const logs = yield* StudioStore.allLogs()
    const metrics = yield* StudioStore.latestMetricsWithHistory(120_000)

    test
      .expect(spans)
      .toHaveLength(1)
    test
      .expect(spans[0])
      .toMatchObject({
        traceId,
        spanId,
        name: "GET /cart",
        kind: "server",
        status: "error",
        durationMs: 10,
        attributes: {
          "otel.status.message": "failed",
          "http.response.status_code": 500,
        },
        resource: {
          attributes: { "service.name": "checkout" },
          droppedAttributesCount: 0,
        },
        instrumentationScope: {
          name: "json-test",
          version: "1.0.0",
          attributes: {},
          droppedAttributesCount: 0,
        },
      })
    test
      .expect(spans[0].attributes)
      .not
      .toHaveProperty("service.name")
    test
      .expect(spans[0].attributes)
      .not
      .toHaveProperty("otel.scope.name")
    test
      .expect(spans[0].events)
      .toEqual([{
        name: "exception",
        startTime: BigInt(timestampNano),
        attributes: { "exception.type": "Error" },
      }])
    test
      .expect(logs)
      .toHaveLength(1)
    test
      .expect(logs[0])
      .toMatchObject({
        timestamp: Number(BigInt(timestampNano) / 1_000_000n),
        level: "WARNING",
        message: "cart is almost full",
        fiberId: `otlp:${traceId}`,
        annotations: {
          "otel.trace_id": traceId,
          "otel.span_id": spanId,
          "cart.items": 99,
        },
        resource: { attributes: { "service.name": "checkout" } },
        instrumentationScope: { name: "json-test" },
      })
    test
      .expect(logs[0].annotations)
      .not
      .toHaveProperty("service.name")
    test
      .expect(logs[0].annotations)
      .not
      .toHaveProperty("otel.scope.name")
    test
      .expect(metrics)
      .toHaveLength(5)

    const cartItems = metrics.find((series) => series.latest.name === "cart.items")

    test
      .expect(cartItems?.latest)
      .toMatchObject({
        name: "cart.items",
        type: "gauge",
        value: 99,
        timestamp: Number(BigInt(timestampNano) / 1_000_000n),
      })
    test
      .expect(cartItems?.latest.tags)
      .toEqual(test.expect.arrayContaining([
        { key: "region", value: "us" },
        { key: "otel.metric.unit", value: "{item}" },
        {
          key: "otel.metric.start_time_unix_nano",
          value: String(BigInt(timestampNano) - 1_000_000n),
        },
        { key: "otel.metric.flags", value: "1" },
      ]))

    const exemplars = cartItems?.latest.tags.find((tag) => tag.key === "otel.metric.exemplars")?.value

    test
      .expect(exemplars && JSON.parse(exemplars))
      .toEqual([{
        filteredAttributes: { sampled: true },
        timeUnixNano: timestampNano,
        asDouble: 98.5,
        spanId,
        traceId,
      }])
    test
      .expect(cartItems?.latest.resource)
      .toMatchObject({
        attributes: { "service.name": "checkout" },
      })
    test
      .expect(cartItems?.latest.instrumentationScope)
      .toMatchObject({ name: "json-test" })
    test
      .expect(cartItems?.latest.tags)
      .not
      .toContainEqual({ key: "service.name", value: "checkout" })
    test
      .expect(cartItems?.latest.tags.some((tag) => tag.key === "otel.scope.name"))
      .toBe(false)
    test
      .expect(metrics.map((series) => [series.latest.name, series.latest.type]))
      .toEqual([
        ["cart.items", "gauge"],
        ["payload.size", "histogram"],
        ["request.duration", "histogram"],
        ["requests.total", "counter"],
        ["response.size", "summary"],
      ])
  })))

test.it("ingests binary protobuf from standard OTLP/HTTP exporters", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    for (
      const [signal, body] of [
        ["traces", binaryTraceRequest()],
        ["logs", binaryLogRequest()],
        ["metrics", binaryMetricRequest()],
      ] as const
    ) {
      const response = yield* request(signal, new Blob([body.buffer as ArrayBuffer]), {
        "content-type": "application/x-protobuf",
      })

      test
        .expect(response.status)
        .toBe(200)
      test
        .expect(response.headers.get("content-type"))
        .toBe("application/x-protobuf")

      const responseBody = yield* Effect.promise(() => response.arrayBuffer())

      test
        .expect(responseBody.byteLength)
        .toBe(0)
    }

    const spans = yield* StudioStore.allSpans()
    const logs = yield* StudioStore.allLogs()
    const metrics = yield* StudioStore.latestMetricsWithHistory(120_000)

    test
      .expect(spans[0])
      .toMatchObject({
        traceId,
        spanId,
        name: "POST /orders",
        kind: "server",
        status: "error",
        attributes: {
          "http.request.method": "POST",
        },
        resource: { attributes: { "service.name": "checkout" } },
        instrumentationScope: { name: "integration-test" },
      })
    test
      .expect(logs[0])
      .toMatchObject({
        level: "ERROR",
        message: "payment failed",
        cause: "declined",
      })
    test
      .expect(metrics[0].latest)
      .toMatchObject({
        name: "queue.depth",
        type: "gauge",
        value: 7.5,
      })
    test
      .expect(metrics[0].latest.tags)
      .toContainEqual({ key: "otel.metric.flags", value: "3" })
  })))

test.it("returns an OTLP partial-success response for invalid spans", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    const response = yield* request(
      "traces",
      JSON.stringify({
        resourceSpans: [{
          scopeSpans: [{
            spans: [{ traceId: "invalid", spanId, name: "invalid" }],
          }],
        }],
      }),
      { "content-type": "application/json" },
    )

    test
      .expect(response.status)
      .toBe(200)

    const responseJson = yield* Effect.promise(() => response.json())

    test
      .expect(responseJson)
      .toEqual({
        partialSuccess: {
          rejectedSpans: "1",
          errorMessage: "1 invalid traces item was rejected",
        },
      })
    test
      .expect(yield* StudioStore.allSpans())
      .toEqual([])
  })))

test.it("returns protocol errors in the requested OTLP encoding", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase
    const malformedJson = yield* request("traces", "{", { "content-type": "application/json" })

    test
      .expect(malformedJson.status)
      .toBe(400)
    test
      .expect(malformedJson.headers.get("content-type"))
      .toBe("application/json")

    const malformedJsonBody = yield* Effect.promise(() => malformedJson.json())

    test
      .expect(malformedJsonBody)
      .toMatchObject({ code: 3 })

    const malformedProto = yield* request("traces", new Blob([Uint8Array.of(0x80)]), {
      "content-type": "application/x-protobuf",
    })

    test
      .expect(malformedProto.status)
      .toBe(400)
    test
      .expect(malformedProto.headers.get("content-type"))
      .toBe("application/x-protobuf")

    const malformedProtoBody = new Uint8Array(
      yield* Effect.promise(() => malformedProto.arrayBuffer()),
    )

    test
      .expect(Array.from(malformedProtoBody.slice(0, 2)))
      .toEqual([8, 3])

    const malformedGzip = yield* request("logs", "not gzip", {
      "content-type": "application/json",
      "content-encoding": "gzip",
    })

    test
      .expect(malformedGzip.status)
      .toBe(400)

    const unsupportedEncoding = yield* request("metrics", "{}", {
      "content-type": "application/json",
      "content-encoding": "br",
    })

    test
      .expect(unsupportedEncoding.status)
      .toBe(415)

    const unsupportedContentType = yield* request("metrics", "{}", {
      "content-type": "text/plain",
    })

    test
      .expect(unsupportedContentType.status)
      .toBe(415)

    const oversized = yield* request("metrics", "{}", {
      "content-type": "application/json",
      "content-length": String(64 * 1024 * 1024 + 1),
    })

    test
      .expect(oversized.status)
      .toBe(413)
  })))

test.it("rejects malformed nested protobuf messages and packed metric fields", () =>
  run(Effect.gen(function*() {
    yield* StudioStore.setupDatabase

    const malformedSpan = concat([
      fieldBytes(1, Uint8Array.fromHex(traceId)),
      fieldBytes(2, Uint8Array.fromHex(spanId)),
      Uint8Array.of((7 << 3) | 1, 0),
    ])
    const traceResponse = yield* request("traces", new Blob([resourceEnvelope(malformedSpan).slice()]), {
      "content-type": "application/x-protobuf",
    })

    test
      .expect(traceResponse.status)
      .toBe(400)

    const traceError = new TextDecoder().decode(
      yield* Effect.promise(() => traceResponse.arrayBuffer()),
    )

    test
      .expect(traceError)
      .toContain(
        "[\"resourceSpans\"][0][\"scopeSpans\"][0][\"spans\"][0][\"protobufField(7)\"]",
      )

    const point = concat([
      fieldFixed64(3, BigInt(timestampNano)),
      fieldFixed64(4, 1n),
      fieldBytes(6, Uint8Array.of(1)),
    ])
    const metric = concat([
      fieldString(1, "malformed.histogram"),
      fieldBytes(9, fieldBytes(1, point)),
    ])
    const metricResponse = yield* request("metrics", new Blob([resourceEnvelope(metric).slice()]), {
      "content-type": "application/x-protobuf",
    })

    test
      .expect(metricResponse.status)
      .toBe(400)

    const metricError = new TextDecoder().decode(
      yield* Effect.promise(() => metricResponse.arrayBuffer()),
    )

    test
      .expect(metricError)
      .toContain(
        "[\"resourceMetrics\"][0][\"scopeMetrics\"][0][\"metrics\"][0][\"histogram\"][\"dataPoints\"][0][\"bucketCounts\"]",
      )
  })))
