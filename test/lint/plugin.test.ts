import * as test from "bun:test"
import * as NFs from "node:fs"
import * as NPath from "node:path"
const tmpDir = NPath.join(import.meta.dirname, ".tmp-lint")

function lint(code: string, filename = "test.ts") {
  NFs.mkdirSync(tmpDir, { recursive: true })
  const filePath = NPath.join(tmpDir, filename)
  NFs.writeFileSync(filePath, code)
  try {
    const result = Bun.spawnSync([
      "bunx",
      "oxlint",
      "--format",
      "json",
      filePath,
    ], {
      cwd: NPath.join(import.meta.dirname, "../.."),
    })
    const json = JSON.parse(result.stdout.toString()) as {
      diagnostics: Array<{
        message: string
        code: string
        severity: string
      }>
    }
    return json.diagnostics
  } finally {
    NFs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function lintRule(code: string, rule: string, filename?: string) {
  return lint(code, filename).filter((d) => d.code === `effect-start(${rule})`)
}

function lintFix(code: string, filename = "test.ts") {
  NFs.mkdirSync(tmpDir, { recursive: true })
  const filePath = NPath.join(tmpDir, filename)
  NFs.writeFileSync(filePath, code)
  try {
    Bun.spawnSync(["bunx", "oxlint", "--fix", filePath], {
      cwd: NPath.join(import.meta.dirname, "../.."),
    })
    return NFs.readFileSync(filePath, "utf-8")
  } finally {
    NFs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

test.describe.skipIf(!process.env.TEST_LINT)("namespace-import", () => {
  test.it("flags named import from capitalized module", () => {
    const diags = lintRule(
      `import { Schema } from "effect/Schema"\nSchema\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows namespace import from capitalized module", () => {
    const diags = lintRule(
      `import * as Schema from "effect/Schema"\nSchema\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags named import from bun:test", () => {
    const diags = lintRule(
      `import { expect } from "bun:test"\nexpect\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("ignores lowercase modules", () => {
    const diags = lintRule(
      `import { start } from "effect-start/lint/server"\nstart\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags named import from internal capitalized module", () => {
    const diags = lintRule(
      `import { mapHeaders } from "../src/internal/Http.ts"\nmapHeaders\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows internal module with matching alias", () => {
    const diags = lintRule(
      `import * as Http from "../src/internal/Http.ts"\nHttp\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags alias that doesn't match basename (local import)", () => {
    const diags = lintRule(
      `import * as Sql from "./SqlClient.ts"\nSql\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows matching alias and basename", () => {
    const diags = lintRule(
      `import * as SqlClient from "./SqlClient.ts"\nSqlClient\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("ignores mismatched alias for package imports", () => {
    const diags = lintRule(
      `import * as S from "effect/Schema"\nS\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("strips file extension for basename comparison", () => {
    const diags = lintRule(
      `import * as Http from "../../src/HttpClient.js"\nHttp\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("flags internal module with mismatched alias", () => {
    const diags = lintRule(
      `import * as Helpers from "../src/internal/Values.ts"\nHelpers\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows internal module with matching alias", () => {
    const diags = lintRule(
      `import * as Values from "../src/internal/Values.ts"\nValues\n`,
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags both duplicate imports from same module", () => {
    const diags = lintRule(
      [
        "import type { Param } from \"./Param.ts\"",
        "import { isParam } from \"./Param.ts\"",
        "const a: Param = isParam(1)",
        "",
      ]
        .join("\n"),
      "namespace-import",
    )

    test
      .expect(diags)
      .toHaveLength(2)
  })
})

test.describe.skipIf(!process.env.TEST_LINT)("test-space-around", () => {
  test.it("flags missing blank line before test call", () => {
    const code = [
      "import * as test from \"bun:test\"",
      "const x = 1",
      "test.it(\"a\", () => {})",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "test-space-around", "a.test.ts")

    test
      .expect(diags.some((d) => d.message.includes("preceded")))
      .toBe(true)
  })

  test.it("flags missing blank line after test call", () => {
    const code = [
      "import * as test from \"bun:test\"",
      "",
      "test.it(\"a\", () => {})",
      "const x = 1",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "test-space-around", "a.test.ts")

    test
      .expect(diags.some((d) => d.message.includes("followed")))
      .toBe(true)
  })

  test.it("allows blank lines around test call", () => {
    const code = [
      "import * as test from \"bun:test\"",
      "",
      "test.it(\"a\", () => {})",
      "",
      "const x = 1",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "test-space-around", "a.test.ts")

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("skips non-test files", () => {
    const code = [
      "import * as test from \"bun:test\"",
      "const x = 1",
      "test.it(\"a\", () => {})",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "test-space-around", "a.ts")

    test
      .expect(diags)
      .toHaveLength(0)
  })
})

test.describe.skipIf(!process.env.TEST_LINT)("schema-type-helpers", () => {
  test.it("flags Schema.Schema.Type<typeof User>", () => {
    const code = [
      "import * as Schema from \"effect/Schema\"",
      "const User = Schema.Struct({ name: Schema.String })",
      "type User = Schema.Schema.Type<typeof User>",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "schema-type-helpers")

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows typeof User.Type", () => {
    const code = [
      "import * as Schema from \"effect/Schema\"",
      "const User = Schema.Struct({ name: Schema.String })",
      "type User = typeof User.Type",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "schema-type-helpers")

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags in export type alias", () => {
    const code = [
      "import * as Schema from \"effect/Schema\"",
      "const Person = Schema.Struct({ age: Schema.Number })",
      "export type Person = Schema.Schema.Type<typeof Person>",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "schema-type-helpers")

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("ignores Schema.Schema.Type with non-typeof param", () => {
    const code = [
      "import * as Schema from \"effect/Schema\"",
      "type User = Schema.Schema.Type<any>",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "schema-type-helpers")

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("ignores Schema.Schema.Type with multiple type params", () => {
    const code = [
      "import * as Schema from \"effect/Schema\"",
      "type User = Schema.Schema.Type<typeof User, typeof User>",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "schema-type-helpers")

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("fixes to typeof X.Type", () => {
    const code = [
      "import * as Schema from \"effect/Schema\"",
      "const User = Schema.Struct({ name: Schema.String })",
      "type User = Schema.Schema.Type<typeof User>",
      "",
    ]
      .join("\n")
    const fixed = lintFix(code)

    test
      .expect(fixed)
      .toContain("type User = typeof User.Type")
  })

  test.it("ignores a local module named Schema", () => {
    const code = [
      "import * as Schema from \"./local.ts\"",
      "type User = Schema.Schema.Type<typeof User>",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "schema-type-helpers")

    test
      .expect(diags)
      .toHaveLength(0)
  })
})

test.describe.skipIf(!process.env.TEST_LINT)("effect-try-promise", () => {
  test.it("flags function form", () => {
    const diags = lintRule(
      `import * as Effect from "effect/Effect"\nEffect.tryPromise(() => fetch("/"))\n`,
      "effect-try-promise",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("flags object form without catch", () => {
    const diags = lintRule(
      `import * as Effect from "effect/Effect"\nEffect.tryPromise({ try: () => fetch("/") })\n`,
      "effect-try-promise",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows object form with try and catch", () => {
    const diags = lintRule(
      `import * as Effect from "effect/Effect"\nEffect.tryPromise({ try: () => fetch("/"), catch: (cause) => cause })\n`,
      "effect-try-promise",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("ignores other Effect calls", () => {
    const diags = lintRule(
      `import * as Effect from "effect/Effect"\nEffect.try(() => JSON.parse("{}"))\n`,
      "effect-try-promise",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags aliased Effect import", () => {
    const diags = lintRule(
      `import * as E from "effect/Effect"\nE.tryPromise(() => fetch("/"))\n`,
      "effect-try-promise",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("ignores a local module named Effect", () => {
    const diags = lintRule(
      `import * as Effect from "./local.ts"\nEffect.tryPromise(() => fetch("/"))\n`,
      "effect-try-promise",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })
})

test.describe.skipIf(!process.env.TEST_LINT)("no-destructured-params", () => {
  test.it("flags arrow function with destructured param", () => {
    const diags = lintRule(
      `const fn = ({ client }: any) => client\nfn\n`,
      "no-destructured-params",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("flags function declaration with destructured param", () => {
    const diags = lintRule(
      `function fn({ client }: any) { return client }\nfn\n`,
      "no-destructured-params",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("flags destructured param with default value", () => {
    const diags = lintRule(
      `const fn = ({ x }: any = {}) => x\nfn\n`,
      "no-destructured-params",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows normal parameters", () => {
    const diags = lintRule(
      `const fn = (client: any) => client\nfn\n`,
      "no-destructured-params",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("allows no parameters", () => {
    const diags = lintRule(`const fn = () => 1\nfn\n`, "no-destructured-params")

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("fixes arrow function with single property", () => {
    const fixed = lintFix(`const fn = ({ client }: any) => client\nfn\n`)

    test
      .expect(fixed)
      .toBe(`const fn = (options: any) => options.client\nfn\n`)
  })

  test.it("fixes arrow function with multiple properties", () => {
    const fixed = lintFix(
      `const fn = ({ fiber, teardown }: any) => { fiber; teardown }\nfn\n`,
    )

    test
      .expect(fixed)
      .toBe(
        `const fn = (options: any) => { options.fiber; options.teardown }\nfn\n`,
      )
  })

  test.it("fixes function declaration", () => {
    const fixed = lintFix(
      `function fn({ client }: any) { return client }\nfn\n`,
    )

    test
      .expect(fixed)
      .toBe(
        `function fn(options: any) { return options.client }\nfn\n`,
      )
  })

  test.it("fixes aliased destructuring", () => {
    const fixed = lintFix(`const fn = ({ client: c }: any) => c\nfn\n`)

    test
      .expect(fixed)
      .toBe(`const fn = (options: any) => options.client\nfn\n`)
  })

  test.it("fixes with type annotation preserved", () => {
    const fixed = lintFix(
      `const fn = ({ fiber, teardown }: { fiber: number; teardown: () => void }) => { fiber; teardown }\nfn\n`,
    )

    test
      .expect(fixed)
      .toBe(
        `const fn = (options: { fiber: number; teardown: () => void }) => { options.fiber; options.teardown }\nfn\n`,
      )
  })

  test.it("fixes with default parameter value", () => {
    const fixed = lintFix(`const fn = ({ x }: any = {}) => x\nfn\n`)

    test
      .expect(fixed)
      .toBe(`const fn = (options: any = {}) => options.x\nfn\n`)
  })

  test.it("fixes multiline real-world pattern", () => {
    const code = [
      "const runMain = makeRunMain(({ fiber, teardown }) => {",
      "  const prev = fiber",
      "  teardown(prev)",
      "})",
      "",
    ]
      .join("\n")
    const fixed = lintFix(code)

    test
      .expect(fixed)
      .toBe(
        [
          "const runMain = makeRunMain((v) => {",
          "  const prev = v.fiber",
          "  v.teardown(prev)",
          "})",
          "",
        ]
          .join("\n"),
      )
  })

  test.it("fixes chained method callback", () => {
    const code = [
      "const x = Effect.map(({ mssql, pool }) => {",
      "  const q = makeTemplate(pool)",
      "  return { mssql, q }",
      "})",
      "",
    ]
      .join("\n")
    const fixed = lintFix(code)

    test
      .expect(fixed)
      .toBe(
        [
          "const x = Effect.map((v) => {",
          "  const q = makeTemplate(v.pool)",
          "  return { mssql: v.mssql, q }",
          "})",
          "",
        ]
          .join("\n"),
      )
  })

  test.it("fixes shorthand property that references destructured var", () => {
    const fixed = lintFix(
      `const fn = ({ a, b }: any) => ({ a, b, c: 1 })\nfn\n`,
    )

    test
      .expect(fixed)
      .toBe(
        `const fn = (options: any) => ({ a: options.a, b: options.b, c: 1 })\nfn\n`,
      )
  })

  test.it("does not auto-fix when properties have defaults", () => {
    const code = `const fn = ({ x = 1, y }: any) => x + y\nfn\n`
    const fixed = lintFix(code)

    test
      .expect(fixed)
      .toBe(code)
  })

  test.it("flags destructured second param in callback", () => {
    const code = [
      "const fn = (job: any, { id, priority, attempts }: any) => {",
      "  console.log(id, priority, attempts, job)",
      "}",
      "fn",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "no-destructured-params")

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("fixes destructured second param in callback", () => {
    const code = [
      "const fn = (job: any, { id, priority, attempts }: any) => {",
      "  console.log(id, priority, attempts, job)",
      "}",
      "fn",
      "",
    ]
      .join("\n")
    const fixed = lintFix(code)

    test
      .expect(fixed)
      .toBe(
        [
          "const fn = (job: any, options: any) => {",
          "  console.log(options.id, options.priority, options.attempts, job)",
          "}",
          "fn",
          "",
        ]
          .join("\n"),
      )
  })

  test.it("avoids shadowing existing variable with suffix", () => {
    const code = [
      "const options = 1",
      "const fn = ({ a }: any) => a + options",
      "fn",
      "",
    ]
      .join(
        "\n",
      )
    const fixed = lintFix(code)

    test
      .expect(fixed)
      .toBe(
        [
          "const options = 1",
          "const fn = (options2: any) => options2.a + options",
          "fn",
          "",
        ]
          .join(
            "\n",
          ),
      )
  })
})

test.describe.skipIf(!process.env.TEST_LINT)("tagged-symbol-name", () => {
  test.it("flags class name that does not match the tag", () => {
    const code = [
      "import * as Data from \"effect/Data\"",
      "export class UnsupportedError extends Data.TaggedError(\"FixtureUnsupportedError\")<{",
      "  readonly message: string",
      "}> {}",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "tagged-symbol-name")

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows class name that matches the tag", () => {
    const code = [
      "import * as Data from \"effect/Data\"",
      "export class FetchError extends Data.TaggedError(\"FetchError\")<{",
      "  readonly message: string",
      "}> {}",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "tagged-symbol-name")

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("ignores unrelated classes", () => {
    const code = [
      "export class Foo {}",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "tagged-symbol-name")

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("fixes the tag to match the class name", () => {
    const code = [
      "import * as Data from \"effect/Data\"",
      "export class UnsupportedError extends Data.TaggedError(\"FixtureUnsupportedError\")<{",
      "  readonly message: string",
      "}> {}",
      "",
    ]
      .join("\n")
    const fixed = lintFix(code)

    test
      .expect(fixed)
      .toContain("Data.TaggedError(\"UnsupportedError\")")
  })

  test.it("flags Data.TaggedClass mismatch", () => {
    const diags = lintRule(
      `import * as Data from "effect/Data"\nexport class Foo extends Data.TaggedClass("Bar")<{}> {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("flags Request.TaggedClass mismatch", () => {
    const diags = lintRule(
      `import * as Request from "effect/Request"\nexport class Foo extends Request.TaggedClass("Bar")<number, never, {}> {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("flags Schema.TaggedError mismatch (double-call)", () => {
    const diags = lintRule(
      `import * as Schema from "effect/Schema"\nexport class Foo extends Schema.TaggedError<Foo>()("Bar", {}) {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows Schema.TaggedError match", () => {
    const diags = lintRule(
      `import * as Schema from "effect/Schema"\nexport class Foo extends Schema.TaggedError<Foo>()("Foo", {}) {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags Schema.TaggedClass and Schema.TaggedRequest mismatch", () => {
    const diags = lintRule(
      [
        "import * as Schema from \"effect/Schema\"",
        "export class A extends Schema.TaggedClass<A>()(\"X\", {}) {}",
        "export class B extends Schema.TaggedRequest<B>()(\"Y\", { failure: Schema.Never, success: Schema.Void, payload: {} }) {}",
        "",
      ]
        .join("\n"),
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(2)
  })

  test.it("flags Schema.Class identifier mismatch (inner-call)", () => {
    const diags = lintRule(
      `import * as Schema from "effect/Schema"\nexport class Foo extends Schema.Class<Foo>("Bar")({}) {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows Context.Tag namespaced identifier matching last segment", () => {
    const diags = lintRule(
      `import * as Context from "effect/Context"\nexport class Routes extends Context.Tag("effect-start/Routes")<Routes, {}>() {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags Context.Tag last-segment mismatch", () => {
    const diags = lintRule(
      `import * as Context from "effect/Context"\nexport class Routes extends Context.Tag("effect-start/Foo")<Routes, {}>() {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("fixes Context.Tag last segment while preserving the namespace prefix", () => {
    const fixed = lintFix(
      `import * as Context from "effect/Context"\nexport class Routes extends Context.Tag("effect-start/Foo")<Routes, {}>() {}\n`,
      "context-tag-fix.ts",
    )

    test
      .expect(fixed)
      .toContain("Context.Tag(\"effect-start/Routes\")")
  })

  test.it("allows Context.Reference namespaced identifier matching last segment", () => {
    const diags = lintRule(
      [
        "import * as Context from \"effect/Context\"",
        "export class RouteContext extends Context.Reference<RouteContext>()(\"effect-start/RouteContext\", { defaultValue: () => 1 }) {}",
        "",
      ]
        .join("\n"),
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags Context.Reference last-segment mismatch", () => {
    const diags = lintRule(
      [
        "import * as Context from \"effect/Context\"",
        "export class RouteContext extends Context.Reference<RouteContext>()(\"effect-start/Nope\", { defaultValue: () => 1 }) {}",
        "",
      ]
        .join("\n"),
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows Effect.Tag and Effect.Service matching last segment", () => {
    const diags = lintRule(
      [
        "import * as Effect from \"effect/Effect\"",
        "export class Notifications extends Effect.Tag(\"app/Notifications\")<Notifications, {}>() {}",
        "export class Cache extends Effect.Service<Cache>()(\"app/Cache\", { succeed: 1 }) {}",
        "",
      ]
        .join("\n"),
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("allows dot-namespaced identifier matching last segment", () => {
    const diags = lintRule(
      `import * as Context from "effect/Context"\nexport class Logger extends Context.Tag("LayerExtra.test.Logger")<Logger, {}>() {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags dot-namespaced identifier with mismatched last segment", () => {
    const diags = lintRule(
      `import * as Context from "effect/Context"\nexport class Logger extends Context.Tag("LayerExtra.test.Nope")<Logger, {}>() {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("allows Context.GenericTag const matching last segment", () => {
    const diags = lintRule(
      `import * as Context from "effect/Context"\nexport const StartServer = Context.GenericTag<StartServer>("effect-start/StartServer")\nStartServer\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags Context.GenericTag const with mismatched last segment", () => {
    const diags = lintRule(
      `import * as Context from "effect/Context"\nexport const StartServer = Context.GenericTag<StartServer>("effect-start/Nope")\nStartServer\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("fixes Context.GenericTag const key preserving the prefix", () => {
    const fixed = lintFix(
      `import * as Context from "effect/Context"\nexport const StartServer = Context.GenericTag<StartServer>("effect-start/Nope")\nStartServer\n`,
      "generic-tag-fix.ts",
    )

    test
      .expect(fixed)
      .toContain("Context.GenericTag<StartServer>(\"effect-start/StartServer\")")
  })

  test.it("allows Schema.TaggedStruct const matching its tag", () => {
    const diags = lintRule(
      `import * as Schema from "effect/Schema"\nexport const File = Schema.TaggedStruct("File", { path: Schema.String })\nFile\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("flags Schema.TaggedStruct const with mismatched tag", () => {
    const diags = lintRule(
      `import * as Schema from "effect/Schema"\nexport const BundleEventChange = Schema.TaggedStruct("Change", { path: Schema.String })\nBundleEventChange\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("resolves aliased namespace import", () => {
    const diags = lintRule(
      `import * as D from "effect/Data"\nexport class Foo extends D.TaggedError("Bar")<{}> {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("resolves barrel import", () => {
    const diags = lintRule(
      `import { Data } from "effect"\nexport class Foo extends Data.TaggedError("Bar")<{}> {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("resolves aliased barrel import", () => {
    const diags = lintRule(
      `import { Data as D } from "effect"\nexport class Foo extends D.TaggedError("Bar")<{}> {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(1)
  })

  test.it("ignores a same-named factory not imported from effect", () => {
    const diags = lintRule(
      `import * as Data from "./local/Data.ts"\nexport class Foo extends Data.TaggedError("Bar")<{}> {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("ignores a factory used with no matching import", () => {
    const diags = lintRule(
      `export class Foo extends Data.TaggedError("Bar")<{}> {}\n`,
      "tagged-symbol-name",
    )

    test
      .expect(diags)
      .toHaveLength(0)
  })
})

test.describe.skipIf(!process.env.TEST_LINT)("test-effects", () => {
  test.it("flags await Effect.runPromise in async test callback", () => {
    const code = [
      "import * as test from \"bun:test\"",
      "import * as Effect from \"effect/Effect\"",
      "test.it(\"x\", async () => { await Effect.runPromise(Effect.void) })",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "test-effects", "a.test.ts")

    test
      .expect(diags.some((d) => d.message.includes("runPromise")))
      .toBe(true)
  })

  test.it("flags Effect.scoped(...) wrapping", () => {
    const code = [
      "import * as test from \"bun:test\"",
      "import * as Effect from \"effect/Effect\"",
      "test.it(\"x\", () => Effect.scoped(Effect.void))",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "test-effects", "a.test.ts")

    test
      .expect(diags.some((d) => d.message.includes("scoped")))
      .toBe(true)
  })

  test.it("resolves aliased Effect and test imports", () => {
    const code = [
      "import * as t from \"bun:test\"",
      "import * as E from \"effect/Effect\"",
      "t.it(\"x\", async () => { await E.runPromise(E.void) })",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "test-effects", "a.test.ts")

    test
      .expect(diags.some((d) => d.message.includes("runPromise")))
      .toBe(true)
  })

  test.it("ignores a local module named Effect", () => {
    const code = [
      "import * as test from \"bun:test\"",
      "import * as Effect from \"./local.ts\"",
      "test.it(\"x\", async () => { await Effect.runPromise(Effect.void) })",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "test-effects", "a.test.ts")

    test
      .expect(diags)
      .toHaveLength(0)
  })

  test.it("skips non-test files", () => {
    const code = [
      "import * as Effect from \"effect/Effect\"",
      "async function run() { await Effect.runPromise(Effect.void) }",
      "run",
      "",
    ]
      .join("\n")
    const diags = lintRule(code, "test-effects", "a.ts")

    test
      .expect(diags)
      .toHaveLength(0)
  })
})
