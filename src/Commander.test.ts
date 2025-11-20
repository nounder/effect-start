import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Commander from "./Commander.ts"

t.it("parses long options with values", async () => {
  const CliSchema = Schema.Struct({
    name: Schema.String,
    age: Commander.NumberFromString,
  })

  const program = Commander.parse(CliSchema, ["--name", "Alice", "--age", "30"])

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ name: "Alice", age: 30 })
})

t.it("parses long options with equals syntax", async () => {
  const CliSchema = Schema.Struct({
    name: Schema.String,
    output: Schema.String,
  })

  const program = Commander.parse(CliSchema, [
    "--name=test",
    "--output=file.txt",
  ])

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ name: "test", output: "file.txt" })
})

t.it("parses short options with aliases", async () => {
  const CliSchema = Schema.Struct({
    verbose: Commander.BooleanFromString,
    output: Schema.String,
  })

  const program = Commander.parse(CliSchema, ["-v", "-o", "out.txt"], {
    aliases: {
      v: "verbose",
      o: "output",
    },
  })

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ verbose: true, output: "out.txt" })
})

t.it("parses boolean flags without values", async () => {
  const CliSchema = Schema.Struct({
    verbose: Schema.Boolean,
    debug: Schema.Boolean,
  })

  const program = Commander.parse(CliSchema, ["--verbose", "--debug"])

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ verbose: true, debug: true })
})

t.it("parses combined short flags", async () => {
  const CliSchema = Schema.Struct({
    a: Schema.Boolean,
    b: Schema.Boolean,
    c: Schema.Boolean,
  })

  const program = Commander.parse(CliSchema, ["-abc"])

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ a: true, b: true, c: true })
})

t.it("parses combined short flags with value for last flag", async () => {
  const CliSchema = Schema.Struct({
    verbose: Schema.Boolean,
    output: Schema.String,
  })

  const program = Commander.parse(CliSchema, ["-vo", "file.txt"], {
    aliases: {
      v: "verbose",
      o: "output",
    },
  })

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ verbose: true, output: "file.txt" })
})

t.it("parses positional arguments", async () => {
  const CliSchema = Schema.Struct({
    source: Schema.String,
    destination: Schema.String,
  })

  const program = Commander.parse(CliSchema, ["src.txt", "dest.txt"], {
    positional: ["source", "destination"],
  })

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ source: "src.txt", destination: "dest.txt" })
})

t.it("parses mix of options and positional arguments", async () => {
  const CliSchema = Schema.Struct({
    verbose: Schema.Boolean,
    file: Schema.String,
    output: Schema.String,
  })

  const program = Commander.parse(
    CliSchema,
    ["--verbose", "input.txt", "-o", "output.txt"],
    {
      aliases: { o: "output" },
      positional: ["file"],
    },
  )

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({
    verbose: true,
    file: "input.txt",
    output: "output.txt",
  })
})

t.it("handles optional fields with Schema.optional", async () => {
  const CliSchema = Schema.Struct({
    name: Schema.String,
    verbose: Schema.optional(Schema.Boolean).pipe(
      Schema.withDecodingDefault(() => false),
    ),
  })

  const program = Commander.parse(CliSchema, ["--name", "test"])

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ name: "test", verbose: false })
})

t.it("transforms number strings to numbers", async () => {
  const CliSchema = Schema.Struct({
    port: Commander.NumberFromString,
    count: Commander.NumberFromString,
  })

  const program = Commander.parse(CliSchema, [
    "--port",
    "8080",
    "--count",
    "42",
  ])

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ port: 8080, count: 42 })
})

t.it("fails on invalid schema validation", async () => {
  const CliSchema = Schema.Struct({
    age: Commander.NumberFromString,
  })

  const program = Commander.parse(CliSchema, ["--age", "invalid"])

  const result = await Effect.runPromise(Effect.either(program))

  if (result._tag === "Left") {
    t.expect(result.left._tag).toBe("ParseError")
    t.expect(result.left.message).toContain("Failed to parse arguments")
  } else {
    throw new Error("Expected parse to fail")
  }
})

t.it("fails when required field is missing", async () => {
  const CliSchema = Schema.Struct({
    name: Schema.String,
    age: Commander.NumberFromString,
  })

  const program = Commander.parse(CliSchema, ["--name", "Alice"])

  const result = await Effect.runPromise(Effect.either(program))

  if (result._tag === "Left") {
    t.expect(result.left._tag).toBe("ParseError")
  } else {
    throw new Error("Expected parse to fail")
  }
})

t.it("handles empty arguments", async () => {
  const CliSchema = Schema.Struct({
    verbose: Schema.optional(Schema.Boolean).pipe(
      Schema.withDecodingDefault(() => false),
    ),
  })

  const program = Commander.parse(CliSchema, [])

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ verbose: false })
})

t.it("parses BooleanFromString with string values", async () => {
  const CliSchema = Schema.Struct({
    enabled: Commander.BooleanFromString,
    disabled: Commander.BooleanFromString,
  })

  const program = Commander.parse(CliSchema, [
    "--enabled",
    "true",
    "--disabled",
    "false",
  ])

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ enabled: true, disabled: false })
})

t.it("parses BooleanFromString with boolean flags", async () => {
  const CliSchema = Schema.Struct({
    verbose: Commander.BooleanFromString,
  })

  const program = Commander.parse(CliSchema, ["--verbose"])

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ verbose: true })
})

t.it("handles complex real-world scenario", async () => {
  const CliSchema = Schema.Struct({
    input: Schema.String,
    output: Schema.String,
    verbose: Schema.optional(Schema.Boolean).pipe(
      Schema.withDecodingDefault(() => false),
    ),
    port: Schema.optional(Commander.NumberFromString).pipe(
      Schema.withDecodingDefault(() => 3000),
    ),
    format: Schema.optional(Schema.Literal("json", "yaml", "xml")).pipe(
      Schema.withDecodingDefault(() => "json" as const),
    ),
  })

  const program = Commander.parse(
    CliSchema,
    [
      "input.txt",
      "--verbose",
      "-o",
      "output.txt",
      "--port",
      "8080",
      "--format",
      "yaml",
    ],
    {
      aliases: {
        o: "output",
        v: "verbose",
        p: "port",
        f: "format",
      },
      positional: ["input"],
    },
  )

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({
    input: "input.txt",
    output: "output.txt",
    verbose: true,
    port: 8080,
    format: "yaml",
  })
})

t.it("handles single dash as positional argument", async () => {
  const CliSchema = Schema.Struct({
    file: Schema.String,
  })

  const program = Commander.parse(CliSchema, ["-"], {
    positional: ["file"],
  })

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ file: "-" })
})

t.it("parses Schema.Literal for enum-like options", async () => {
  const CliSchema = Schema.Struct({
    mode: Schema.Literal("dev", "prod", "test"),
  })

  const program = Commander.parse(CliSchema, ["--mode", "prod"])

  const result = await Effect.runPromise(program)

  t.expect(result).toEqual({ mode: "prod" })
})

t.it("fails on invalid literal value", async () => {
  const CliSchema = Schema.Struct({
    mode: Schema.Literal("dev", "prod", "test"),
  })

  const program = Commander.parse(CliSchema, ["--mode", "invalid"])

  const result = await Effect.runPromise(Effect.either(program))

  if (result._tag === "Left") {
    t.expect(result.left._tag).toBe("ParseError")
  } else {
    throw new Error("Expected parse to fail")
  }
})
