/** @jsxImportSource effect-start */
import * as test from "bun:test"
import * as Html from "../../src/Html.ts"
import * as Traces from "../../src/studio/ui/Traces.tsx"
import type * as StudioStore from "../../src/studio/StudioStore.ts"

function makeSpan(
  options: Partial<StudioStore.StudioSpan> & Pick<StudioStore.StudioSpan, "spanId" | "traceId" | "name">,
): StudioStore.StudioSpan {
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
  const spans: Array<StudioStore.StudioSpan> = [
    makeSpan({
      spanId: 1n,
      traceId: 42n,
      name: "root-ish",
      parentSpanId: 3n,
      startTime: 1_000_000n,
      endTime: 5_000_000n,
      durationMs: 4,
    }),
    makeSpan({
      spanId: 2n,
      traceId: 42n,
      name: "middle",
      parentSpanId: 1n,
      startTime: 2_000_000n,
      endTime: 4_000_000n,
      durationMs: 2,
    }),
    makeSpan({
      spanId: 3n,
      traceId: 42n,
      name: "cycle",
      parentSpanId: 2n,
      startTime: 3_000_000n,
      endTime: 3_500_000n,
      durationMs: 0.5,
      status: "error",
    }),
  ]

  const html = Html.renderToString(<Traces.TraceDetail prefix="/studio" spans={spans} />)

  test.expect(html).toContain("root-ish")
  test.expect(html).toContain("middle")
  test.expect(html).toContain("cycle")
  test.expect(html).toContain("/studio/traces")
})
