/** @jsxImportSource effect-start */
import * as test from "bun:test"
import * as Html from "../../src/Html.ts"
import type * as StudioStore from "../../src/studio/StudioStore.ts"
import * as Traces from "../../src/studio/ui.tsx"

function makeSpan(
  options:
    & Partial<StudioStore.Span>
    & Pick<StudioStore.Span, "spanId" | "traceId" | "name">,
): StudioStore.Span {
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
  const spans: Array<StudioStore.Span> = [
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

  const html = Html.text(<Traces.TraceDetail prefix="/studio" spans={spans} />)

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
