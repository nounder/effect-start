"""Sample Python service instrumented with OpenTelemetry.

Exports traces, logs and metrics over OTLP/HTTP (protobuf) to the recording proxy.
"""
import logging
import os
import time

from opentelemetry import metrics, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import SpanKind, Status, StatusCode

ENDPOINT = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")

resource = Resource.create({
    "service.name": "py-checkout",
    "service.version": "2.1.0",
    "deployment.environment": "lab",
})

tracer_provider = TracerProvider(resource=resource)
tracer_provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{ENDPOINT}/v1/traces"))
)
trace.set_tracer_provider(tracer_provider)

logger_provider = LoggerProvider(resource=resource)
logger_provider.add_log_record_processor(
    BatchLogRecordProcessor(OTLPLogExporter(endpoint=f"{ENDPOINT}/v1/logs"))
)
set_logger_provider(logger_provider)

# Attach to our own logger only. Attaching to the root logger makes the exporter's
# own urllib3/http.client log lines feed back in as new records to export.
log = logging.getLogger("checkout")
log.addHandler(LoggingHandler(logger_provider=logger_provider))
log.setLevel(logging.DEBUG)
log.propagate = False

meter_provider = MeterProvider(
    resource=resource,
    metric_readers=[
        PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=f"{ENDPOINT}/v1/metrics"),
            export_interval_millis=2000,
        )
    ],
)
metrics.set_meter_provider(meter_provider)

tracer = trace.get_tracer("py.checkout.instrumentation", "0.3.0")
meter = metrics.get_meter("py.checkout.instrumentation", "0.3.0")

order_counter = meter.create_counter(
    "orders.submitted", unit="{order}", description="Orders submitted by customers"
)
cart_gauge = meter.create_up_down_counter(
    "cart.value", unit="USD", description="Total value held in open carts"
)
latency = meter.create_histogram(
    "checkout.latency", unit="ms", description="End to end checkout latency"
)


def charge_card(order_id: str, amount: float) -> None:
    with tracer.start_as_current_span(
        "charge-card",
        kind=SpanKind.CLIENT,
        attributes={"payment.amount": amount, "payment.currency": "USD"},
    ) as span:
        time.sleep(0.01)
        span.add_event("gateway.request", {"gateway": "stripe", "retry": 0})
        if amount > 500:
            span.set_status(Status(StatusCode.ERROR, "card declined"))
            span.record_exception(ValueError(f"declined for order {order_id}"))
            log.error("payment declined for order %s", order_id)
            raise ValueError("card declined")
        log.info("charged %.2f for order %s", amount, order_id)


def submit_order(order_id: str, amount: float) -> None:
    start = time.monotonic()
    with tracer.start_as_current_span(
        "POST /orders",
        kind=SpanKind.SERVER,
        attributes={
            "http.request.method": "POST",
            "url.path": "/orders",
            "order.id": order_id,
            "order.items": 3,
        },
    ) as span:
        log.debug("validating order %s", order_id)
        with tracer.start_as_current_span("validate-cart") as child:
            child.set_attribute("cart.item_count", 3)
            time.sleep(0.005)

        try:
            charge_card(order_id, amount)
            span.set_attribute("http.response.status_code", 201)
            order_counter.add(1, {"outcome": "accepted", "region": "eu"})
            cart_gauge.add(-amount, {"region": "eu"})
        except ValueError:
            span.set_attribute("http.response.status_code", 402)
            span.set_status(Status(StatusCode.ERROR, "payment rejected"))
            order_counter.add(1, {"outcome": "rejected", "region": "eu"})

    latency.record((time.monotonic() - start) * 1000, {"route": "/orders"})


def main() -> None:
    log.warning("py-checkout starting up, endpoint=%s", ENDPOINT)
    cart_gauge.add(1250.0, {"region": "eu"})
    submit_order("ord-1001", 120.50)
    submit_order("ord-1002", 980.00)
    submit_order("ord-1003", 42.25)

    with tracer.start_as_current_span("nightly-reconcile", kind=SpanKind.INTERNAL) as span:
        span.set_attribute("batch.size", 3)
        span.add_event("reconcile.done", {"mismatches": 0})
        log.info("reconciliation finished")

    tracer_provider.force_flush()
    logger_provider.force_flush()
    meter_provider.force_flush()
    tracer_provider.shutdown()
    logger_provider.shutdown()
    meter_provider.shutdown()
    print("python app done")


if __name__ == "__main__":
    main()
