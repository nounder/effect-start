/** @jsxImportSource effect-start */
import * as test from "bun:test"
import * as Html from "../../src/Html.ts"
import type * as Tracing from "../../src/internal/Tracing.ts"
import * as Traces from "../../src/studio/ui.tsx"

function makeSpan(
  options:
    & Partial<Tracing.Span>
    & Pick<Tracing.Span, "spanId" | "traceId" | "name">,
): Tracing.Span {
  return {
    spanId: options.spanId,
    traceId: options.traceId,
    fiberId: options.fiberId,
    name: options.name,
    kind: options.kind ?? "internal",
    parentSpanId: options.parentSpanId,
    startTime: options.startTime ?? 0n,
    endTime: options.endTime,
    durationMs: options.durationMs,
    status: options.status ?? "ok",
    attributes: options.attributes ?? {},
    events: options.events ?? [],
  }
}

test.it("TraceDetail renders cyclic spans without recursing forever", () => {
  const spans: Array<Tracing.Span> = [
    makeSpan({
      spanId: "1",
      traceId: "42",
      name: "root-ish",
      parentSpanId: "3",
      startTime: 1_000_000n,
      endTime: 5_000_000n,
      durationMs: 4,
    }),
    makeSpan({
      spanId: "2",
      traceId: "42",
      name: "middle",
      parentSpanId: "1",
      startTime: 2_000_000n,
      endTime: 4_000_000n,
      durationMs: 2,
    }),
    makeSpan({
      spanId: "3",
      traceId: "42",
      name: "cycle",
      parentSpanId: "2",
      startTime: 3_000_000n,
      endTime: 3_500_000n,
      durationMs: 0.5,
      status: "error",
    }),
  ]

  const html = Html.text(
    <Traces.TraceDetail prefix="/studio" spans={spans} logs={[]} />,
  )

  test
    .expect(html)
    .toContain("root-ish")
  test
    .expect(html)
    .toContain("middle")
  test
    .expect(html)
    .toContain("cycle")
  test
    .expect(html)
    .toContain("/studio/traces")
})

test.it("TraceGroup hides duration while root span is running", () => {
  const html = Html.text(
    <Traces.TraceGroup
      prefix="/studio"
      spans={[
        makeSpan({
          spanId: "1",
          traceId: "99",
          name: "GET /api",
          startTime: BigInt(Date.now()) * 1_000_000n,
          status: "started",
        }),
      ]}
    />,
  )

  test.expect(html).not.toContain("0µs")
  test.expect(html).not.toContain("...")
})

test.it("TraceDetail hides duration labels while spans are running", () => {
  const html = Html.text(
    <Traces.TraceDetail
      prefix="/studio"
      spans={[
        makeSpan({
          spanId: "1",
          traceId: "99",
          name: "root",
          startTime: BigInt(Date.now() - 100) * 1_000_000n,
          status: "started",
        }),
        makeSpan({
          spanId: "2",
          traceId: "99",
          name: "child",
          parentSpanId: "1",
          startTime: BigInt(Date.now() - 50) * 1_000_000n,
          status: "started",
        }),
      ]}
      logs={[]}
    />,
  )

  test.expect(html).not.toContain("wf-dur")
})
