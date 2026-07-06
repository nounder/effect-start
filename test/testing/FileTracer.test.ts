import * as test from "bun:test"
import { FileTracer } from "effect-start/testing"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as NPath from "node:path"
import * as FileSystem from "../../src/FileSystem.ts"
import * as NodeFileSystem from "../../src/node/NodeFileSystem.ts"

const decodeRow = Schema.decodeUnknownSync(FileTracer.RowFromJson)

const parseJsonl = (contents: string): Array<FileTracer.Row> =>
  contents
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => decodeRow(line))

const withTrace = <A, E>(
  options: {
    readonly filter?: (span: FileTracer.Span) => boolean
  },
  spans: (path: string) => Effect.Effect<A, E, never>,
): Promise<string> =>
  Effect
    .gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* fs.makeTempDirectoryScoped()
      const path = NPath.join(dir, "trace.jsonl")

      yield* Effect.scoped(
        Effect.provide(spans(path), FileTracer.layer({ path, ...options })),
      )

      return yield* fs.readFileString(path)
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    )

test.it("writes one JSON object per line", async () => {
  const output = await withTrace(
    { filter: () => true },
    () =>
      Effect.annotateCurrentSpan("phase", "warmup").pipe(
        Effect.withSpan("child"),
        Effect.withSpan("parent"),
      ),
  )
  const rows = parseJsonl(output)
  const parent = rows.find((row) => row.name === "parent")!
  const child = rows.find((row) => row.name === "child")!

  test
    .expect(rows)
    .toHaveLength(2)
  test
    .expect(parent.parentId)
    .toBeNull()
  test
    .expect(child.parentId)
    .toBe(parent.id)
  test
    .expect(child.attributes)
    .toEqual({ phase: "warmup" })
})

test.it("shares a trace id across spans in the same trace", async () => {
  const output = await withTrace(
    { filter: () => true },
    () => Effect.withSpan("leaf")(Effect.void).pipe(Effect.withSpan("root")),
  )
  const rows = parseJsonl(output)

  test
    .expect(rows)
    .toHaveLength(2)
  test
    .expect(rows[0].traceId)
    .toBe(rows[1].traceId)
})

test.it("each line is independently valid JSON", async () => {
  const output = await withTrace(
    { filter: () => true },
    () =>
      Effect.all([
        Effect.withSpan("a")(Effect.void),
        Effect.withSpan("b")(Effect.void),
        Effect.withSpan("c")(Effect.void),
      ]),
  )
  const lines = output.split("\n").filter((line) => line.length > 0)

  test
    .expect(lines)
    .toHaveLength(3)
  for (const line of lines) {
    test
      .expect(() => decodeRow(line))
      .not
      .toThrow()
  }
})

test.it("drops spans rejected by the filter", async () => {
  const output = await withTrace(
    { filter: (span) => span.name !== "hidden" },
    () =>
      Effect.withSpan("leaf")(Effect.void).pipe(
        Effect.withSpan("hidden"),
        Effect.withSpan("root"),
      ),
  )
  const names = parseJsonl(output).map((row) => row.name)

  test
    .expect(names)
    .not
    .toContain("hidden")
  test
    .expect(names)
    .toContain("root")
  test
    .expect(names)
    .toContain("leaf")
})

test.it("writes nothing when no spans are recorded", async () => {
  const output = await withTrace({ filter: () => true }, () => Effect.void)

  test
    .expect(output)
    .toBe("")
})

test.it("appends across multiple scopes to the same file", async () => {
  const output = await Effect
    .gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* fs.makeTempDirectoryScoped()
      const path = NPath.join(dir, "trace.jsonl")

      yield* Effect.scoped(
        Effect.provide(
          Effect.withSpan("first")(Effect.void),
          FileTracer.layer({ path, filter: () => true }),
        ),
      )
      yield* Effect.scoped(
        Effect.provide(
          Effect.withSpan("second")(Effect.void),
          FileTracer.layer({ path, filter: () => true }),
        ),
      )

      return yield* fs.readFileString(path)
    })
    .pipe(
      Effect.scoped,
      Effect.provide(NodeFileSystem.layer),
      Effect.runPromise,
    )
  const rows = parseJsonl(output)

  test
    .expect(rows.map((row) => row.name))
    .toEqual(["first", "second"])
})
