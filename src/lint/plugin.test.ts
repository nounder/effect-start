import * as test from "bun:test"
import * as NFs from "node:fs"
import * as NPath from "node:path"
const tmpDir = NPath.join(import.meta.dirname, ".tmp-lint")

function lint(code: string, filename = "test.ts") {
  NFs.mkdirSync(tmpDir, { recursive: true })
  const filePath = NPath.join(tmpDir, filename)
  NFs.writeFileSync(filePath, code)
  try {
    const result = Bun.spawnSync(["bunx", "oxlint", "--format", "json", filePath], {
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

test.describe.skipIf(!process.env.TEST_LINT)("prefer-namespace-import", () => {
  test.it("flags named import from capitalized module", () => {
    const diags = lintRule(
      `import { Schema } from "effect/Schema"\nSchema\n`,
      "prefer-namespace-import",
    )
    test.expect(diags).toHaveLength(1)
  })

  test.it("allows namespace import from capitalized module", () => {
    const diags = lintRule(
      `import * as Schema from "effect/Schema"\nSchema\n`,
      "prefer-namespace-import",
    )
    test.expect(diags).toHaveLength(0)
  })

  test.it("flags named import from bun:test", () => {
    const diags = lintRule(
      `import { expect } from "bun:test"\nexpect\n`,
      "prefer-namespace-import",
    )
    test.expect(diags).toHaveLength(1)
  })

  test.it("ignores lowercase modules", () => {
    const diags = lintRule(
      `import { start } from "./server.ts"\nstart\n`,
      "prefer-namespace-import",
    )
    test.expect(diags).toHaveLength(0)
  })
})

test.describe.skipIf(!process.env.TEST_LINT)("test-space-around", () => {
  test.it("flags missing blank line before test call", () => {
    const code = [
      'import * as test from "bun:test"',
      "const x = 1",
      'test.it("a", () => {})',
      "",
    ].join("\n")
    const diags = lintRule(code, "test-space-around", "a.test.ts")
    test.expect(diags.some((d) => d.message.includes("preceded"))).toBe(true)
  })

  test.it("flags missing blank line after test call", () => {
    const code = [
      'import * as test from "bun:test"',
      "",
      'test.it("a", () => {})',
      "const x = 1",
      "",
    ].join("\n")
    const diags = lintRule(code, "test-space-around", "a.test.ts")
    test.expect(diags.some((d) => d.message.includes("followed"))).toBe(true)
  })

  test.it("allows blank lines around test call", () => {
    const code = [
      'import * as test from "bun:test"',
      "",
      'test.it("a", () => {})',
      "",
      "const x = 1",
      "",
    ].join("\n")
    const diags = lintRule(code, "test-space-around", "a.test.ts")
    test.expect(diags).toHaveLength(0)
  })

  test.it("skips non-test files", () => {
    const code = [
      'import * as test from "bun:test"',
      "const x = 1",
      'test.it("a", () => {})',
      "",
    ].join("\n")
    const diags = lintRule(code, "test-space-around", "a.ts")
    test.expect(diags).toHaveLength(0)
  })
})

test.describe.skipIf(!process.env.TEST_LINT)("no-destructured-params", () => {
  test.it("flags arrow function with destructured param", () => {
    const diags = lintRule(
      `const fn = ({ client }: any) => client\nfn\n`,
      "no-destructured-params",
    )
    test.expect(diags).toHaveLength(1)
  })

  test.it("flags function declaration with destructured param", () => {
    const diags = lintRule(
      `function fn({ client }: any) { return client }\nfn\n`,
      "no-destructured-params",
    )
    test.expect(diags).toHaveLength(1)
  })

  test.it("flags destructured param with default value", () => {
    const diags = lintRule(
      `const fn = ({ x }: any = {}) => x\nfn\n`,
      "no-destructured-params",
    )
    test.expect(diags).toHaveLength(1)
  })

  test.it("allows normal parameters", () => {
    const diags = lintRule(
      `const fn = (client: any) => client\nfn\n`,
      "no-destructured-params",
    )
    test.expect(diags).toHaveLength(0)
  })

  test.it("allows no parameters", () => {
    const diags = lintRule(
      `const fn = () => 1\nfn\n`,
      "no-destructured-params",
    )
    test.expect(diags).toHaveLength(0)
  })

  test.it("fixes arrow function with single property", () => {
    const fixed = lintFix(`const fn = ({ client }: any) => client\nfn\n`)
    test.expect(fixed).toBe(`const fn = (options: any) => options.client\nfn\n`)
  })

  test.it("fixes arrow function with multiple properties", () => {
    const fixed = lintFix(
      `const fn = ({ fiber, teardown }: any) => { fiber; teardown }\nfn\n`,
    )
    test.expect(fixed).toBe(
      `const fn = (options: any) => { options.fiber; options.teardown }\nfn\n`,
    )
  })

  test.it("fixes function declaration", () => {
    const fixed = lintFix(
      `function fn({ client }: any) { return client }\nfn\n`,
    )
    test.expect(fixed).toBe(
      `function fn(options: any) { return options.client }\nfn\n`,
    )
  })

  test.it("fixes aliased destructuring", () => {
    const fixed = lintFix(
      `const fn = ({ client: c }: any) => c\nfn\n`,
    )
    test.expect(fixed).toBe(`const fn = (options: any) => options.client\nfn\n`)
  })

  test.it("fixes with type annotation preserved", () => {
    const fixed = lintFix(
      `const fn = ({ fiber, teardown }: { fiber: number; teardown: () => void }) => { fiber; teardown }\nfn\n`,
    )
    test.expect(fixed).toBe(
      `const fn = (options: { fiber: number; teardown: () => void }) => { options.fiber; options.teardown }\nfn\n`,
    )
  })

  test.it("fixes with default parameter value", () => {
    const fixed = lintFix(
      `const fn = ({ x }: any = {}) => x\nfn\n`,
    )
    test.expect(fixed).toBe(`const fn = (options: any = {}) => options.x\nfn\n`)
  })

  test.it("fixes multiline real-world pattern", () => {
    const code = [
      "const runMain = makeRunMain(({ fiber, teardown }) => {",
      "  const prev = fiber",
      "  teardown(prev)",
      "})",
      "",
    ].join("\n")
    const fixed = lintFix(code)
    test.expect(fixed).toBe(
      [
        "const runMain = makeRunMain((options) => {",
        "  const prev = options.fiber",
        "  options.teardown(prev)",
        "})",
        "",
      ].join("\n"),
    )
  })

  test.it("fixes chained method callback", () => {
    const code = [
      "const x = Effect.map(({ mssql, pool }) => {",
      "  const q = makeTemplate(pool)",
      "  return { mssql, q }",
      "})",
      "",
    ].join("\n")
    const fixed = lintFix(code)
    test.expect(fixed).toBe(
      [
        "const x = Effect.map((options) => {",
        "  const q = makeTemplate(options.pool)",
        "  return { mssql: options.mssql, q }",
        "})",
        "",
      ].join("\n"),
    )
  })

  test.it("fixes shorthand property that references destructured var", () => {
    const fixed = lintFix(
      `const fn = ({ a, b }: any) => ({ a, b, c: 1 })\nfn\n`,
    )
    test.expect(fixed).toBe(
      `const fn = (options: any) => ({ a: options.a, b: options.b, c: 1 })\nfn\n`,
    )
  })

  test.it("avoids shadowing existing variable with suffix", () => {
    const code = [
      "const options = 1",
      "const fn = ({ a }: any) => a + options",
      "fn",
      "",
    ].join("\n")
    const fixed = lintFix(code)
    test.expect(fixed).toBe(
      [
        "const options = 1",
        "const fn = (options2: any) => options2.a + options",
        "fn",
        "",
      ].join("\n"),
    )
  })
})
