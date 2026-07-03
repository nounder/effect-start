import * as test from "bun:test"
import { TestTracer } from "effect-start/testing"
import * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import * as NProcess from "node:process"

function runTrace<A, E>(
  options: {
    readonly json?: boolean
    readonly filter?: (span: TestTracer.Span) => boolean
    readonly print?: string
  },
  spans: Effect.Effect<A, E, never>,
): Promise<string> {
  const previous = NProcess.env.TRACE_PRINT
  const original = globalThis.console.log
  const lines: Array<string> = []
  globalThis.console.log = (...args: Array<unknown>) => lines.push(args.join(" "))
  if (options.print === undefined) delete NProcess.env.TRACE_PRINT
  else NProcess.env.TRACE_PRINT = options.print
  const layer: Layer.Layer<never> = TestTracer.layer({ json: options.json, filter: options.filter })
  return spans
    .pipe(
      Effect.scoped,
      Effect.provide(layer),
      Effect.runPromise,
    )
    .then(() => lines.join("\n"))
    .finally(() => {
      globalThis.console.log = original
      if (previous === undefined) delete NProcess.env.TRACE_PRINT
      else NProcess.env.TRACE_PRINT = previous
    })
}

test.it("captures nested spans as an indented tree with attributes", async () => {
  const output = await runTrace(
    { print: "true", filter: () => true },
    Effect.annotateCurrentSpan("phase", "warmup").pipe(
      Effect.withSpan("child"),
      Effect.withSpan("parent"),
    ),
  )
  const lines = output.split("\n")
  const parentLine = lines.find((line) => line.includes("parent"))!
  const childLine = lines.find((line) => line.includes("child"))!

  test
    .expect(output)
    .toContain("[trace]")

  test
    .expect(parentLine.search(/\S/))
    .toBeLessThan(childLine.search(/\S/))

  test
    .expect(childLine)
    .toContain(`{"phase":"warmup"}`)
})

test.it("drops spans rejected by the filter, reparenting their children", async () => {
  const output = await runTrace(
    { print: "true", filter: (span) => span.name !== "hidden" },
    Effect.withSpan("leaf")(Effect.void).pipe(
      Effect.withSpan("hidden"),
      Effect.withSpan("root"),
    ),
  )
  const lines = output.split("\n")
  const rootLine = lines.find((line) => line.includes("root"))!
  const leafLine = lines.find((line) => line.includes("leaf"))!

  test
    .expect(output)
    .not
    .toContain("hidden")

  test
    .expect(leafLine.search(/\S/))
    .toBe(rootLine.search(/\S/) + 2)
})

test.it("emits serialized JSON with string ids when json is enabled", async () => {
  const output = await runTrace(
    { print: "true", json: true, filter: () => true },
    Effect.withSpan("root")(Effect.void),
  )
  const rows = JSON.parse(output.slice(output.indexOf("[trace json]") + "[trace json]".length))

  test
    .expect(output)
    .toContain("[trace json]")

  test
    .expect(rows)
    .toHaveLength(1)

  test
    .expect(rows[0])
    .toMatchObject({ name: "root", parentId: null })

  test
    .expect(rows[0].id)
    .toMatch(/^\d+$/)
})

test.it("does not print when TRACE_PRINT is not set", async () => {
  const output = await runTrace(
    { print: undefined },
    Effect.withSpan("root")(Effect.void),
  )

  test
    .expect(output)
    .toBe("")
})

test.it("still records spans when TRACE_PRINT is not set", async () => {
  const span = await Effect
    .currentSpan
    .pipe(
      Effect.withSpan("root"),
      Effect.scoped,
      Effect.provide(TestTracer.layer()),
      Effect.runPromise,
    )

  test
    .expect(span.name)
    .toBe("root")
  test
    .expect(span.spanId)
    .toMatch(/^\d+$/)
})
