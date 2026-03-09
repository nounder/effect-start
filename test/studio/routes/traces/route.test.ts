import * as test from "bun:test"
import * as StudioStore from "../../../../src/studio/StudioStore.ts"

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

test.describe("traces route", () => {
  test.it("detects studio traces by attribute", () => {
    const spans: Array<StudioStore.StudioSpan> = [
      makeSpan({
        spanId: 1n,
        traceId: 42n,
        name: "GET /studio/traces",
        attributes: { [StudioStore.studioTraceAttribute]: true },
      }),
    ]

    test.expect(StudioStore.isStudioTrace(spans)).toBe(true)
  })

  test.it("removes all spans for traces marked as studio", () => {
    const spans: Array<StudioStore.StudioSpan> = [
      makeSpan({
        spanId: 1n,
        traceId: 1n,
        name: "app root",
      }),
      makeSpan({
        spanId: 2n,
        traceId: 2n,
        name: "studio root",
        attributes: { [StudioStore.studioTraceAttribute]: true },
      }),
      makeSpan({
        spanId: 3n,
        traceId: 2n,
        name: "studio child",
      }),
    ]

    test.expect(StudioStore.filterOutStudioSpans(spans).map((span) => span.traceId)).toEqual([
      1n,
    ])
  })
})
