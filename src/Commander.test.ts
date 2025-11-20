import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Commander from "./Commander.ts"

t.it("parses boolean flags with long form", async () => {
  const schema = Commander.boolean("--verbose")

  const result = await Effect.runPromise(
    Commander.parse(schema, ["--verbose"]),
  )

  t.expect(result).toBe(true)
})

t.it("parses boolean flags with short form", async () => {
  const schema = Commander.boolean("--verbose", "-v")

  const result = await Effect.runPromise(
    Commander.parse(schema, ["-v"]),
  )

  t.expect(result).toBe(true)
})

t.it("returns false when boolean flag is absent", async () => {
  const schema = Commander.boolean("--verbose")

  const result = await Effect.runPromise(
    Commander.parse(schema, []),
  )

  t.expect(result).toBe(false)
})

t.it("parses string options with long form", async () => {
  const schema = Commander.string("--name")

  const result = await Effect.runPromise(
    Commander.parse(schema, ["--name", "test"]),
  )

  t.expect(Option.isSome(result)).toBe(true)
  if (Option.isSome(result)) {
    t.expect(result.value).toBe("test")
  }
})

t.it("parses string options with short form", async () => {
  const schema = Commander.string("--name", "-n")

  const result = await Effect.runPromise(
    Commander.parse(schema, ["-n", "test"]),
  )

  t.expect(Option.isSome(result)).toBe(true)
  if (Option.isSome(result)) {
    t.expect(result.value).toBe("test")
  }
})

t.it("returns None when string option is absent", async () => {
  const schema = Commander.string("--name")

  const result = await Effect.runPromise(
    Commander.parse(schema, []),
  )

  t.expect(Option.isNone(result)).toBe(true)
})

t.it("parses number options with long form", async () => {
  const schema = Commander.number("--port")

  const result = await Effect.runPromise(
    Commander.parse(schema, ["--port", "3000"]),
  )

  t.expect(Option.isSome(result)).toBe(true)
  if (Option.isSome(result)) {
    t.expect(result.value).toBe(3000)
  }
})

t.it("parses number options with short form", async () => {
  const schema = Commander.number("--port", "-p")

  const result = await Effect.runPromise(
    Commander.parse(schema, ["-p", "8080"]),
  )

  t.expect(Option.isSome(result)).toBe(true)
  if (Option.isSome(result)) {
    t.expect(result.value).toBe(8080)
  }
})

t.it("returns None when number option is invalid", async () => {
  const schema = Commander.number("--port")

  const result = await Effect.runPromise(
    Commander.parse(schema, ["--port", "invalid"]),
  )

  t.expect(Option.isNone(result)).toBe(true)
})

t.it("parses literal options", async () => {
  const schema = Commander.literal("--env", "-e", ["dev", "prod", "staging"])

  const result = await Effect.runPromise(
    Commander.parse(schema, ["--env", "prod"]),
  )

  t.expect(Option.isSome(result)).toBe(true)
  if (Option.isSome(result)) {
    t.expect(result.value).toBe("prod")
  }
})

t.it("returns None when literal option has invalid value", async () => {
  const schema = Commander.literal("--env", "-e", ["dev", "prod", "staging"])

  const result = await Effect.runPromise(
    Commander.parse(schema, ["--env", "invalid"]),
  )

  t.expect(Option.isNone(result)).toBe(true)
})

t.it("parses positional arguments", async () => {
  const schema = Commander.argument(0)

  const result = await Effect.runPromise(
    Commander.parse(schema, ["myfile.txt"]),
  )

  t.expect(Option.isSome(result)).toBe(true)
  if (Option.isSome(result)) {
    t.expect(result.value).toBe("myfile.txt")
  }
})

t.it("returns None when positional argument is absent", async () => {
  const schema = Commander.argument(0)

  const result = await Effect.runPromise(
    Commander.parse(schema, []),
  )

  t.expect(Option.isNone(result)).toBe(true)
})

t.it("parses varargs", async () => {
  const schema = Commander.varargs()

  const result = await Effect.runPromise(
    Commander.parse(schema, ["file1.txt", "file2.txt", "file3.txt"]),
  )

  t.expect(result).toEqual(["file1.txt", "file2.txt", "file3.txt"])
})

t.it("returns empty array for varargs when no arguments", async () => {
  const schema = Commander.varargs()

  const result = await Effect.runPromise(
    Commander.parse(schema, []),
  )

  t.expect(result).toEqual([])
})

t.it("parses combined options and arguments", async () => {
  const schema = Commander.fromStruct({
    verbose: Commander.boolean("--verbose", "-v"),
    port: Commander.number("--port", "-p"),
    files: Commander.varargs(),
  })

  const result = await Effect.runPromise(
    Commander.parse(schema, [
      "--verbose",
      "--port",
      "3000",
      "file1.txt",
      "file2.txt",
    ]),
  )

  t.expect(result.verbose).toBe(true)
  t.expect(Option.isSome(result.port)).toBe(true)
  if (Option.isSome(result.port)) {
    t.expect(result.port.value).toBe(3000)
  }
  t.expect(result.files).toEqual(["file1.txt", "file2.txt"])
})

t.it("parses mixed short and long options", async () => {
  const schema = Commander.fromStruct({
    verbose: Commander.boolean("--verbose", "-v"),
    name: Commander.string("--name", "-n"),
    port: Commander.number("--port", "-p"),
  })

  const result = await Effect.runPromise(
    Commander.parse(schema, ["-v", "--name", "test", "-p", "8080"]),
  )

  t.expect(result.verbose).toBe(true)
  t.expect(Option.isSome(result.name)).toBe(true)
  if (Option.isSome(result.name)) {
    t.expect(result.name.value).toBe("test")
  }
  t.expect(Option.isSome(result.port)).toBe(true)
  if (Option.isSome(result.port)) {
    t.expect(result.port.value).toBe(8080)
  }
})

t.it("separates flags from arguments correctly", async () => {
  const schema = Commander.fromStruct({
    verbose: Commander.boolean("--verbose"),
    files: Commander.varargs(),
  })

  const result = await Effect.runPromise(
    Commander.parse(schema, ["--verbose", "file1.txt", "file2.txt"]),
  )

  t.expect(result.verbose).toBe(true)
  t.expect(result.files).toEqual(["file1.txt", "file2.txt"])
})

t.it("handles options with values that look like flags", async () => {
  const schema = Commander.string("--message")

  const result = await Effect.runPromise(
    Commander.parse(schema, ["--message", "test"]),
  )

  t.expect(Option.isSome(result)).toBe(true)
  if (Option.isSome(result)) {
    t.expect(result.value).toBe("test")
  }
})

t.it("parses complex command structure", async () => {
  const schema = Commander.fromStruct({
    verbose: Commander.boolean("--verbose", "-v"),
    output: Commander.string("--output", "-o"),
    format: Commander.literal("--format", "-f", ["json", "yaml", "toml"]),
    input: Commander.argument(0),
    extraFiles: Commander.varargs(),
  })

  const result = await Effect.runPromise(
    Commander.parse(schema, [
      "-v",
      "--output",
      "result.json",
      "-f",
      "json",
      "input.txt",
    ]),
  )

  t.expect(result.verbose).toBe(true)
  t.expect(Option.isSome(result.output)).toBe(true)
  if (Option.isSome(result.output)) {
    t.expect(result.output.value).toBe("result.json")
  }
  t.expect(Option.isSome(result.format)).toBe(true)
  if (Option.isSome(result.format)) {
    t.expect(result.format.value).toBe("json")
  }
  t.expect(Option.isSome(result.input)).toBe(true)
  if (Option.isSome(result.input)) {
    t.expect(result.input.value).toBe("input.txt")
  }
})

t.it("parseWithDefaults applies default values", async () => {
  const schema = Commander.fromStruct({
    verbose: Commander.boolean("--verbose"),
    port: Commander.number("--port"),
  })

  const result = await Effect.runPromise(
    Commander.parseWithDefaults(
      schema,
      { verbose: false, port: Option.some(8080) },
      ["--verbose"],
    ),
  )

  t.expect(result.verbose).toBe(true)
  t.expect(Option.isSome(result.port)).toBe(true)
  if (Option.isSome(result.port)) {
    t.expect(result.port.value).toBe(8080)
  }
})
