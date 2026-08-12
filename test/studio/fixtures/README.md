# OTLP traffic fixture

`otlp-traffic.ndjson` is a recording of real OpenTelemetry exporter traffic,
replayed by `test/studio/OpenTelemetryTraffic.test.ts`. One JSON object per line:

| field                | meaning                                         |
| -------------------- | ----------------------------------------------- |
| `seq`                | request order within the capture                |
| `path`               | `/v1/traces`, `/v1/logs` or `/v1/metrics`       |
| `requestHeaders`     | headers as sent by the exporter                 |
| `requestBodyBase64`  | request body, base64                            |
| `status`             | status the studio ingest returned when recorded |
| `responseBodyBase64` | response body, base64                           |

The current capture holds 7 requests covering every signal in both wire formats:

- **Python** `opentelemetry-sdk` 1.44 via `opentelemetry-exporter-otlp-proto-http`,
  service `py-checkout` — OTLP/HTTP **protobuf**.
- **Node** `@opentelemetry/sdk-{trace-node,logs,metrics}` 2.10/0.221,
  service `js-storefront` — OTLP/HTTP **JSON**.

## Regenerating

The capture was produced by pointing both SDKs at a recording proxy that appends
each request to this file and forwards it to a studio server:

```
sample app --OTLP--> proxy (:4317) --forwards--> studio server (:4318/studio/v1/*)
                       |
                       +-- appends to otlp-traffic.ndjson
```

The proxy must buffer the body and then drop hop-by-hop headers
(`transfer-encoding`, `connection`, `keep-alive`, `content-length`) before
forwarding — the Node exporter sends `transfer-encoding: chunked`, which no
longer describes a buffered body and makes the upstream reject it with a 400.

Two things to watch for when writing the sample apps:

- Attach the Python `LoggingHandler` to your own logger, not the root logger.
  On the root logger the exporter's own HTTP client log lines feed back in as new
  records to export, which loops indefinitely.
- In `@opentelemetry/sdk-logs` 0.221 the log record processors take an options
  object (`new BatchLogRecordProcessor({ exporter })`). Passing the exporter
  positionally leaves it undefined, so records are silently dropped and
  `shutdown()` throws.

## Regression this fixture caught

Proto3 omits `is_monotonic` when false, which is how both SDKs encode an up/down
counter. `OpenTelemetry.ts` used to read

```ts
const monotonic = sum ? varintValue(sum, "isMonotonic", 3) !== 0n : false
```

where `varintValue` returns `undefined` for the absent field, making
`undefined !== 0n` true — so Python's `cart.value` gauge was persisted as a
`counter`. It now coalesces the missing field first:

```ts
const monotonic = sum ? (varintValue(sum, "isMonotonic", 3) ?? 0n) !== 0n : false
```

Two tests pin this down from both sides: `classifies non-monotonic protobuf sums
as gauges` covers the absent-field encoding, and `classifies an explicit JSON
isMonotonic:false sum as a gauge` covers the JSON path, which was never broken.
