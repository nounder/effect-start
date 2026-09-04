/**
 * Sample JavaScript service used to capture OpenTelemetry traffic.
 * Exports traces, logs and metrics over OTLP/HTTP (JSON) to the recording proxy.
 */
import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api"
import { logs } from "@opentelemetry/api-logs"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs"
import { AggregationTemporality, MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-node"

const ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317"

const resource = resourceFromAttributes({
  "service.name": "js-storefront",
  "service.version": "4.0.1",
  "deployment.environment": "lab",
})

const tracerProvider = new NodeTracerProvider({
  resource,
  spanProcessors: [
    new BatchSpanProcessor(new OTLPTraceExporter({ url: `${ENDPOINT}/v1/traces` })),
  ],
})
tracerProvider.register()

const loggerProvider = new LoggerProvider({
  resource,
  // sdk-logs 0.221 takes an options object here, not a positional exporter.
  processors: [
    new BatchLogRecordProcessor({
      exporter: new OTLPLogExporter({ url: `${ENDPOINT}/v1/logs` }),
    }),
  ],
})
logs.setGlobalLoggerProvider(loggerProvider)

const meterProvider = new MeterProvider({
  resource,
  readers: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${ENDPOINT}/v1/metrics`,
        temporalityPreference: AggregationTemporality.CUMULATIVE,
      }),
      exportIntervalMillis: 2000,
    }),
  ],
})

const tracer = trace.getTracer("js.storefront.instrumentation", "1.2.0")
const logger = loggerProvider.getLogger("js.storefront.instrumentation", "1.2.0")
const meter = meterProvider.getMeter("js.storefront.instrumentation", "1.2.0")

const pageViews = meter.createCounter("page.views", {
  unit: "{view}",
  description: "Storefront page views",
})
const activeSessions = meter.createUpDownCounter("sessions.active", {
  unit: "{session}",
  description: "Currently active sessions",
})
const renderTime = meter.createHistogram("page.render", {
  unit: "ms",
  description: "Server side render duration",
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function loadProducts() {
  return tracer.startActiveSpan(
    "db.query products",
    {
      kind: SpanKind.CLIENT,
      attributes: { "db.system": "postgresql", "db.statement": "SELECT * FROM products LIMIT 20" },
    },
    async (child) => {
      await sleep(8)
      child.addEvent("rows.fetched", { rows: 20 })
      child.setAttribute("db.rows_affected", 20)
      child.end()
      return 20
    },
  )
}

async function renderPage(path, shouldFail) {
  const started = performance.now()
  await tracer.startActiveSpan(
    `GET ${path}`,
    {
      kind: SpanKind.SERVER,
      attributes: { "http.request.method": "GET", "url.path": path, "user.tier": "gold" },
    },
    async (span) => {
      logger.emit({
        severityNumber: 9,
        severityText: "INFO",
        body: `rendering ${path}`,
        attributes: { "url.path": path },
      })

      const rows = await loadProducts(span)
      span.setAttribute("products.count", rows)

      if (shouldFail) {
        const error = new Error(`template missing for ${path}`)
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: "render failed" })
        span.setAttribute("http.response.status_code", 500)
        logger.emit({
          severityNumber: 17,
          severityText: "ERROR",
          body: error.message,
          attributes: { "exception.type": "Error", "exception.stacktrace": error.stack },
        })
      } else {
        span.setAttribute("http.response.status_code", 200)
        pageViews.add(1, { path, outcome: "ok" })
      }

      span.end()
    },
  )
  renderTime.record(performance.now() - started, { path })
}

logger.emit({
  severityNumber: 13,
  severityText: "WARN",
  body: "js-storefront booting",
  attributes: { endpoint: ENDPOINT },
})

activeSessions.add(12, { region: "us" })
await renderPage("/", false)
await renderPage("/products", false)
await renderPage("/checkout", true)
activeSessions.add(-3, { region: "us" })

await tracerProvider.shutdown()
await loggerProvider.shutdown()
await meterProvider.shutdown()
// eslint-disable-next-line no-console
console.log("js app done")
