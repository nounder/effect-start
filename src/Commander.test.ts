import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as assert from "node:assert"
import * as Commander from "./Commander.ts"

test.describe(`${Commander.make.name}`, () => {
  test.it("should create a basic command", () => {
    const cmd = Commander.make({
      name: "test-app",
      description: "A test application",
    })

    test.expect(cmd.name).toBe("test-app")
    test.expect(cmd.description).toBe("A test application")
  })
})

test.describe(`${Commander.option.name} - nested builder API`, () => {
  test.it("should add an option with schema", () => {
    const cmd = Commander.make({ name: "app" }).option(
      Commander.option("--output", "-o").schema(Schema.String),
    )

    test.expect(cmd.options.output).toBeDefined()
    test.expect(cmd.options.output.long).toBe("--output")
    test.expect(cmd.options.output.short).toBe("o")
  })

  test.it("should add option with description", () => {
    const cmd = Commander.make({ name: "app" }).option(
      Commander.option("--output", "-o").description("Output file").schema(Schema.String),
    )

    test.expect(cmd.options.output.description).toBe("Output file")
  })

  test.it("should add option with default value", () => {
    const cmd = Commander.make({ name: "app" }).option(
      Commander.option("--count", "-c").default(10).schema(Commander.NumberFromString),
    )

    test.expect(cmd.options.count.defaultValue).toBe(10)
  })

  test.it("should chain multiple options", () => {
    const cmd = Commander.make({ name: "app" })
      .option(Commander.option("--input", "-i").schema(Schema.String))
      .option(Commander.option("--output", "-o").schema(Schema.String))

    test.expect(cmd.options.input).toBeDefined()
    test.expect(cmd.options.output).toBeDefined()
    test.expect(cmd.options.input.long).toBe("--input")
    test.expect(cmd.options.output.long).toBe("--output")
  })
})

test.describe(`${Commander.parse.name} - kebab-to-camel conversion`, () => {
  test.it("should convert kebab-case to camelCase", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--input-file").schema(Schema.String),
      )

      const result = yield* Commander.parse(cmd, ["--input-file", "test.txt"])

      test.expect(result.inputFile).toBe("test.txt")
    }).pipe(Effect.runPromise),
  )

  test.it("should handle single word options", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port").schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, ["--port", "3000"])

      test.expect(result.port).toBe(3000)
    }).pipe(Effect.runPromise),
  )

  test.it("should parse short options", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port", "-p").schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, ["-p", "8080"])

      test.expect(result.port).toBe(8080)
    }).pipe(Effect.runPromise),
  )

  test.it("should parse multiple options", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" })
        .option(Commander.option("--host", "-h").schema(Schema.String))
        .option(Commander.option("--port", "-p").schema(Commander.NumberFromString))

      const result = yield* Commander.parse(cmd, ["--host", "localhost", "--port", "3000"])

      test.expect(result.host).toBe("localhost")
      test.expect(result.port).toBe(3000)
    }).pipe(Effect.runPromise),
  )

  test.it("should handle options with equals syntax", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port").schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, ["--port=3000"])

      test.expect(result.port).toBe(3000)
    }).pipe(Effect.runPromise),
  )

  test.it("should use default value when option not provided", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port", "-p").default(3000).schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, [])

      test.expect(result.port).toBe(3000)
    }).pipe(Effect.runPromise),
  )

  test.it("should override default when option specified", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port", "-p").default(3000).schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, ["--port", "8080"])

      test.expect(result.port).toBe(8080)
    }).pipe(Effect.runPromise),
  )
})

test.describe(`${Commander.optionHelp.name}`, () => {
  test.it("should add help option", () => {
    const cmd = Commander.make({ name: "app" }).optionHelp()

    test.expect(cmd.options.help).toBeDefined()
    test.expect(cmd.options.help.long).toBe("--help")
    test.expect(cmd.options.help.short).toBe("h")
  })
})

test.describe(`${Commander.optionVersion.name}`, () => {
  test.it("should add version option", () => {
    const cmd = Commander.make({
      name: "app",
      version: "1.0.0",
    }).optionVersion()

    test.expect(cmd.options.version).toBeDefined()
    test.expect(cmd.options.version.long).toBe("--version")
    test.expect(cmd.options.version.short).toBe("V")
  })
})

test.describe(`${Commander.handle.name}`, () => {
  test.it("should mark command as handled", () => {
    const handled = Commander.make({ name: "app" })
      .option(Commander.option("--name", "-n").schema(Schema.String))
      .handle((opts) => Effect.void)

    const unhandled = Commander.make({ name: "app2" }).option(
      Commander.option("--name", "-n").schema(Schema.String),
    )

    test.expect(handled.handler).toBeDefined()
    test.expect(unhandled.handler).toBeUndefined()
  })
})

test.describe(`${Commander.subcommand.name}`, () => {
  test.it("should add subcommand", () => {
    const subCmd = Commander.make({ name: "format" })
      .option(Commander.option("--style").schema(Schema.String))
      .handle((opts) => Effect.void)

    const main = Commander.make({ name: "main" }).subcommand(subCmd)

    test.expect(main.subcommands.length).toBe(1)
    test.expect(main.subcommands[0]!.command.name).toBe("format")
  })
})

test.describe(`${Commander.help.name}`, () => {
  test.it("should generate help text", () => {
    const cmd = Commander.make({
      name: "myapp",
      description: "My awesome application",
      version: "1.0.0",
    })
      .option(Commander.option("--output", "-o").description("Output file").schema(Schema.String))
      .optionHelp()

    const helpText = Commander.help(cmd)

    test.expect(helpText).toContain("My awesome application")
    test.expect(helpText).toContain("Usage: myapp [options]")
    test.expect(helpText).toContain("--output")
    test.expect(helpText).toContain("-o,")
    test.expect(helpText).toContain("Output file")
    test.expect(helpText).toContain("--help")
  })
})

test.describe("BooleanFromString", () => {
  test.it("should decode true value", () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(Schema.BooleanFromString)("true")

      test.expect(result).toBe(true)
    }).pipe(Effect.runPromise),
  )

  test.it("should decode false value", () =>
    Effect.gen(function* () {
      const result = yield* Schema.decode(Schema.BooleanFromString)("false")

      test.expect(result).toBe(false)
    }).pipe(Effect.runPromise),
  )
})

test.describe(`${Commander.choice.name}`, () => {
  test.it("should accept valid choice", () =>
    Effect.gen(function* () {
      const ColorSchema = Schema.compose(Schema.String, Schema.Literal("red", "green", "blue"))

      const result = yield* Schema.decode(ColorSchema)("red")

      test.expect(result).toBe("red")
    }).pipe(Effect.runPromise),
  )

  test.it("should fail on invalid choice", () =>
    Effect.gen(function* () {
      const ColorSchema = Schema.compose(Schema.String, Schema.Literal("red", "green", "blue"))

      const result = yield* Effect.either(Schema.decode(ColorSchema)("yellow"))

      test.expect(result._tag).toBe("Left")
    }).pipe(Effect.runPromise),
  )
})

test.describe(`${Commander.repeatable.name}`, () => {
  test.it("should parse comma-separated values", () =>
    Effect.gen(function* () {
      const schema = Commander.repeatable(Schema.String)

      const result = yield* Schema.decode(schema)("foo,bar,baz")

      test.expect(result).toEqual(["foo", "bar", "baz"])
    }).pipe(Effect.runPromise),
  )

  test.it("should parse comma-separated numbers", () =>
    Effect.gen(function* () {
      const schema = Commander.repeatable(Commander.NumberFromString)

      const result = yield* Schema.decode(schema)("1,2,3,4,5")

      test.expect(result).toEqual([1, 2, 3, 4, 5])
    }).pipe(Effect.runPromise),
  )

  test.it("should trim whitespace", () =>
    Effect.gen(function* () {
      const schema = Commander.repeatable(Schema.String)

      const result = yield* Schema.decode(schema)("foo, bar , baz")

      test.expect(result).toEqual(["foo", "bar", "baz"])
    }).pipe(Effect.runPromise),
  )

  test.it("should encode back to string", () =>
    Effect.gen(function* () {
      const schema = Commander.repeatable(Schema.String)

      const result = yield* Schema.encode(schema)(["foo", "bar", "baz"])

      test.expect(result).toBe("foo,bar,baz")
    }).pipe(Effect.runPromise),
  )
})

test.describe("integration", () => {
  test.it("should work with builder pattern", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({
        name: "converter",
        description: "Convert files",
        version: "2.1.0",
      })
        .option(Commander.option("--input", "-i").description("Input file").schema(Schema.String))
        .option(
          Commander.option("--output", "-o")
            .description("Output file")
            .default("output.txt")
            .schema(Schema.String),
        )
        .option(
          Commander.option("--format", "-f")
            .default("json")
            .schema(Schema.compose(Schema.String, Schema.Literal("json", "xml", "yaml"))),
        )
        .optionHelp()

      const result = yield* Commander.parse(cmd, ["--input", "input.txt", "-f", "yaml"])

      test.expect(result.input).toBe("input.txt")
      test.expect(result.output).toBe("output.txt")
      test.expect(result.format).toBe("yaml")
      test.expect(result.help).toBe(false)
    }).pipe(Effect.runPromise),
  )

  test.it("should handle kebab-case option names", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" })
        .option(Commander.option("--dry-run").default(false).schema(Schema.BooleanFromString))
        .option(Commander.option("--cache-dir").schema(Schema.String))

      const result = yield* Commander.parse(cmd, ["--dry-run", "true", "--cache-dir", "/tmp/cache"])

      test.expect(result.dryRun).toBe(true)
      test.expect(result.cacheDir).toBe("/tmp/cache")
    }).pipe(Effect.runPromise),
  )
})

test.describe(`${Commander.parse.name} - comprehensive`, () => {
  test.it("should parse with explicit args", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port", "-p").schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, ["--port", "3000"])

      test.expect(result.port).toBe(3000)
    }).pipe(Effect.runPromise),
  )

  test.it("should parse short options", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port", "-p").schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, ["-p", "8080"])

      test.expect(result.port).toBe(8080)
    }).pipe(Effect.runPromise),
  )

  test.it("should parse multiple options", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" })
        .option(Commander.option("--host", "-h").schema(Schema.String))
        .option(Commander.option("--port", "-p").schema(Commander.NumberFromString))

      const result = yield* Commander.parse(cmd, ["--host", "localhost", "--port", "3000"])

      test.expect(result.host).toBe("localhost")
      test.expect(result.port).toBe(3000)
    }).pipe(Effect.runPromise),
  )

  test.it("should handle options with equals syntax", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port").schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, ["--port=3000"])

      test.expect(result.port).toBe(3000)
    }).pipe(Effect.runPromise),
  )

  test.it("should parse combined short flags", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" })
        .option(Commander.option("--verbose", "-v").default(false).schema(Schema.BooleanFromString))
        .option(Commander.option("--debug", "-d").default(false).schema(Schema.BooleanFromString))

      const result = yield* Commander.parse(cmd, [])

      test.expect(result.verbose).toBe(false)
      test.expect(result.debug).toBe(false)
    }).pipe(Effect.runPromise),
  )
})

test.describe("boolean options", () => {
  test.it("should return false for boolean flag when not specified", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--verbose", "-v").default(false).schema(Schema.BooleanFromString),
      )

      const result = yield* Commander.parse(cmd, [])

      test.expect(result.verbose).toBe(false)
    }).pipe(Effect.runPromise),
  )

  test.it("should return true for boolean flag when specified", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--verbose", "-v").default(false).schema(Schema.BooleanFromString),
      )

      const result = yield* Commander.parse(cmd, ["--verbose", "true"])

      test.expect(result.verbose).toBe(true)
    }).pipe(Effect.runPromise),
  )

  test.it("should handle boolean with custom default", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--color").default("auto").schema(Schema.String),
      )

      const result = yield* Commander.parse(cmd, [])

      test.expect(result.color).toBe("auto")
    }).pipe(Effect.runPromise),
  )
})

test.describe("options with choices", () => {
  test.it("should accept valid choice", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--color", "-c").schema(
          Schema.compose(Schema.String, Schema.Literal("red", "green", "blue")),
        ),
      )

      const result = yield* Commander.parse(cmd, ["--color", "red"])

      test.expect(result.color).toBe("red")
    }).pipe(Effect.runPromise),
  )

  test.it("should reject invalid choice", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--color", "-c").schema(
          Schema.compose(Schema.String, Schema.Literal("red", "green", "blue")),
        ),
      )

      const result = yield* Effect.either(Commander.parse(cmd, ["--color", "yellow"]))

      test.expect(result._tag).toBe("Left")
    }).pipe(Effect.runPromise),
  )

  test.it("should handle multiple choice options", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" })
        .option(
          Commander.option("--format", "-f")
            .default("json")
            .schema(Schema.compose(Schema.String, Schema.Literal("json", "xml", "yaml"))),
        )
        .option(
          Commander.option("--level", "-l")
            .default("info")
            .schema(Schema.compose(Schema.String, Schema.Literal("debug", "info", "warn", "error"))),
        )

      const result = yield* Commander.parse(cmd, ["--format", "xml", "--level", "debug"])

      test.expect(result.format).toBe("xml")
      test.expect(result.level).toBe("debug")
    }).pipe(Effect.runPromise),
  )
})

test.describe("options with defaults", () => {
  test.it("should use default when option not specified", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port", "-p").default(3000).schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, [])

      test.expect(result.port).toBe(3000)
    }).pipe(Effect.runPromise),
  )

  test.it("should override default when option specified", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port", "-p").default(3000).schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, ["--port", "8080"])

      test.expect(result.port).toBe(8080)
    }).pipe(Effect.runPromise),
  )

  test.it("should handle multiple defaults", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" })
        .option(Commander.option("--host").default("localhost").schema(Schema.String))
        .option(Commander.option("--port").default(3000).schema(Commander.NumberFromString))
        .option(Commander.option("--debug").default(false).schema(Schema.BooleanFromString))

      const result = yield* Commander.parse(cmd, [])

      test.expect(result.host).toBe("localhost")
      test.expect(result.port).toBe(3000)
      test.expect(result.debug).toBe(false)
    }).pipe(Effect.runPromise),
  )

  test.it("should use default for string option", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--output", "-o").default("output.txt").schema(Schema.String),
      )

      const result = yield* Commander.parse(cmd, [])

      test.expect(result.output).toBe("output.txt")
    }).pipe(Effect.runPromise),
  )
})

test.describe("action/handler", () => {
  test.it("should invoke handler with parsed options", () =>
    Effect.gen(function* () {
      let capturedOptions: any = null

      const cmd = Commander.make({ name: "app" })
        .option(Commander.option("--name", "-n").schema(Schema.String))
        .handle((opts) =>
          Effect.sync(() => {
            capturedOptions = opts
          }),
        )

      const parsed = yield* Commander.parse(cmd, ["--name", "test"])

      test.expect(parsed.name).toBe("test")
    }).pipe(Effect.runPromise),
  )

  test.it("should support async handlers", () =>
    Effect.gen(function* () {
      let executed = false

      const cmd = Commander.make({ name: "app" })
        .option(Commander.option("--delay").default(0).schema(Commander.NumberFromString))
        .handle((opts) =>
          Effect.gen(function* () {
            yield* Effect.sleep(opts.delay)
            executed = true
          }),
        )

      yield* Commander.parse(cmd, ["--delay", "10"])
      test.expect(executed).toBe(false)
    }).pipe(Effect.runPromise),
  )

  test.it("should pass all options to handler", () => {
    let capturedOpts: any = null

    const cmd = Commander.make({ name: "app" })
      .option(Commander.option("--input", "-i").schema(Schema.String))
      .option(Commander.option("--output", "-o").schema(Schema.String))
      .option(Commander.option("--verbose", "-v").default(false).schema(Schema.BooleanFromString))
      .handle((opts) =>
        Effect.sync(() => {
          capturedOpts = opts
        }),
      )

    return Effect.runPromise(Commander.parse(cmd, ["-i", "in.txt", "-o", "out.txt", "-v", "true"]))
  })
})

test.describe(`${Commander.optionVersion.name} - version behavior`, () => {
  test.it("should include version in command definition", () => {
    const cmd = Commander.make({
      name: "app",
      version: "1.0.0",
    }).optionVersion()

    test.expect(cmd.version).toBe("1.0.0")
    test.expect(cmd.options.version).toBeDefined()
  })

  test.it("should handle version without version option", () => {
    const cmd = Commander.make({ name: "app", version: "2.0.0" })

    test.expect(cmd.version).toBe("2.0.0")
    test.expect(cmd.options["version"]).toBeUndefined()
  })

  test.it("should include version option in help", () => {
    const cmd = Commander.make({
      name: "app",
      version: "1.0.0",
    }).optionVersion()

    const help = Commander.help(cmd)

    test.expect(help).toContain("--version")
    test.expect(help).toContain("-V")
  })
})

test.describe(`${Commander.help.name} - comprehensive`, () => {
  test.it("should generate help with description", () => {
    const cmd = Commander.make({
      name: "myapp",
      description: "A test application",
    }).optionHelp()

    const help = Commander.help(cmd)

    test.expect(help).toContain("A test application")
    test.expect(help).toContain("Usage: myapp [options]")
  })

  test.it("should include all options in help", () => {
    const cmd = Commander.make({ name: "app" })
      .option(Commander.option("--input", "-i").description("Input file").schema(Schema.String))
      .option(Commander.option("--output", "-o").description("Output file").schema(Schema.String))
      .optionHelp()

    const help = Commander.help(cmd)

    test.expect(help).toContain("--input")
    test.expect(help).toContain("-i,")
    test.expect(help).toContain("Input file")
    test.expect(help).toContain("--output")
    test.expect(help).toContain("-o,")
    test.expect(help).toContain("Output file")
  })

  test.it("should show subcommands in help", () => {
    const subCmd = Commander.make({
      name: "init",
      description: "Initialize project",
    }).handle(() => Effect.void)

    const cmd = Commander.make({ name: "app" }).subcommand(subCmd).optionHelp()

    const help = Commander.help(cmd)

    test.expect(help).toContain("Commands:")
    test.expect(help).toContain("init")
    test.expect(help).toContain("Initialize project")
  })

  test.it("should format option descriptions properly", () => {
    const cmd = Commander.make({ name: "app" }).option(
      Commander.option("--config", "-c").description("Config file path").schema(Schema.String),
    )

    const help = Commander.help(cmd)

    test.expect(help).toContain("-c, --config")
    test.expect(help).toContain("Config file path")
  })
})

test.describe(`${Commander.subcommand.name} - comprehensive`, () => {
  test.it("should add subcommand", () => {
    const subCmd = Commander.make({ name: "build" })
      .option(Commander.option("--watch", "-w").default(false).schema(Schema.BooleanFromString))
      .handle(() => Effect.void)

    const cmd = Commander.make({ name: "app" }).subcommand(subCmd)

    test.expect(cmd.subcommands.length).toBe(1)
    test.expect(cmd.subcommands[0]!.command.name).toBe("build")
  })

  test.it("should add multiple subcommands", () => {
    const build = Commander.make({ name: "build" }).handle(() => Effect.void)

    const testCmd = Commander.make({ name: "test" }).handle(() => Effect.void)

    const cmd = Commander.make({ name: "app" }).subcommand(build).subcommand(testCmd)

    test.expect(cmd.subcommands.length).toBe(2)
    test.expect(cmd.subcommands[0]!.command.name).toBe("build")
    test.expect(cmd.subcommands[1]!.command.name).toBe("test")
  })

  test.it("should nest subcommands", () => {
    const deploy = Commander.make({ name: "deploy" }).handle(() => Effect.void)

    const build = Commander.make({ name: "build" })
      .subcommand(deploy)
      .handle(() => Effect.void)

    const cmd = Commander.make({ name: "app" }).subcommand(build)

    test.expect(cmd.subcommands[0]!.command.subcommands.length).toBe(1)
    test.expect(cmd.subcommands[0]!.command.subcommands[0]!.command.name).toBe("deploy")
  })
})

test.describe("option types", () => {
  test.it("should parse string option", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--name").schema(Schema.String),
      )

      const result = yield* Commander.parse(cmd, ["--name", "test"])

      test.expect(result.name).toBe("test")
      test.expect(typeof result.name).toBe("string")
    }).pipe(Effect.runPromise),
  )

  test.it("should parse number option", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--count").schema(Commander.NumberFromString),
      )

      const result = yield* Commander.parse(cmd, ["--count", "42"])

      test.expect(result.count).toBe(42)
      test.expect(typeof result.count).toBe("number")
    }).pipe(Effect.runPromise),
  )

  test.it("should parse boolean option", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--enabled").schema(Schema.BooleanFromString),
      )

      const result = yield* Commander.parse(cmd, ["--enabled", "true"])

      test.expect(result.enabled).toBe(true)
      test.expect(typeof result.enabled).toBe("boolean")
    }).pipe(Effect.runPromise),
  )

  test.it("should fail on invalid number", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--count").schema(Commander.NumberFromString),
      )

      const result = yield* Effect.either(Commander.parse(cmd, ["--count", "not-a-number"]))

      test.expect(result._tag).toBe("Left")
    }).pipe(Effect.runPromise),
  )
})

test.describe("complex scenarios", () => {
  test.it("should handle mixed option types", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "server" })
        .option(Commander.option("--host", "-h").default("localhost").schema(Schema.String))
        .option(Commander.option("--port", "-p").default(3000).schema(Commander.NumberFromString))
        .option(Commander.option("--ssl").default(false).schema(Schema.BooleanFromString))
        .option(
          Commander.option("--env", "-e")
            .default("development")
            .schema(
              Schema.compose(Schema.String, Schema.Literal("development", "production", "test")),
            ),
        )

      const result = yield* Commander.parse(cmd, [
        "--host",
        "0.0.0.0",
        "-p",
        "8080",
        "--ssl",
        "true",
        "-e",
        "production",
      ])

      test.expect(result.host).toBe("0.0.0.0")
      test.expect(result.port).toBe(8080)
      test.expect(result.ssl).toBe(true)
      test.expect(result.env).toBe("production")
    }).pipe(Effect.runPromise),
  )

  test.it("should handle repeatable options", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--tags", "-t").schema(Commander.repeatable(Schema.String)),
      )

      const result = yield* Commander.parse(cmd, ["--tags", "foo,bar,baz"])

      test.expect(result.tags).toEqual(["foo", "bar", "baz"])
    }).pipe(Effect.runPromise),
  )

  test.it("should preserve option order independence", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" })
        .option(Commander.option("--first").schema(Schema.String))
        .option(Commander.option("--second").schema(Schema.String))

      const result1 = yield* Commander.parse(cmd, ["--first", "1", "--second", "2"])

      const result2 = yield* Commander.parse(cmd, ["--second", "2", "--first", "1"])

      test.expect(result1.first).toBe("1")
      test.expect(result1.second).toBe("2")
      test.expect(result2.first).toBe("1")
      test.expect(result2.second).toBe("2")
    }).pipe(Effect.runPromise),
  )

  test.it("should handle options with hyphens in names", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" })
        .option(Commander.option("--dry-run").default(false).schema(Schema.BooleanFromString))
        .option(Commander.option("--no-cache").default(false).schema(Schema.BooleanFromString))

      const result = yield* Commander.parse(cmd, ["--dry-run", "true", "--no-cache", "true"])

      test.expect(result.dryRun).toBe(true)
      test.expect(result.noCache).toBe(true)
    }).pipe(Effect.runPromise),
  )
})

test.describe("error handling", () => {
  test.it("should fail gracefully on invalid option value", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--port").schema(Commander.NumberFromString),
      )

      const result = yield* Effect.either(Commander.parse(cmd, ["--port", "invalid"]))

      assert.strictEqual(result._tag, "Left")

      test.expect(result.left.message).toContain("Invalid value")
    }).pipe(Effect.runPromise),
  )

  test.it("should fail on invalid choice", () =>
    Effect.gen(function* () {
      const cmd = Commander.make({ name: "app" }).option(
        Commander.option("--mode").schema(
          Schema.compose(Schema.String, Schema.Literal("dev", "prod")),
        ),
      )

      const result = yield* Effect.either(Commander.parse(cmd, ["--mode", "staging"]))

      test.expect(result._tag).toBe("Left")
    }).pipe(Effect.runPromise),
  )
})

test.describe("builder pattern", () => {
  test.it("should chain option definitions fluently", () => {
    const cmd = Commander.make({ name: "app" })
      .option(Commander.option("--input", "-i").description("Input file").schema(Schema.String))
      .option(
        Commander.option("--output", "-o")
          .description("Output file")
          .default("out.txt")
          .schema(Schema.String),
      )

    test.expect(cmd.options.input.description).toBe("Input file")
    test.expect(cmd.options.output.description).toBe("Output file")
    test.expect(cmd.options.output.defaultValue).toBe("out.txt")
  })

  test.it("should chain description and default in any order", () => {
    const cmd1 = Commander.make({ name: "app" }).option(
      Commander.option("--port")
        .description("Port number")
        .default(3000)
        .schema(Commander.NumberFromString),
    )

    const cmd2 = Commander.make({ name: "app" }).option(
      Commander.option("--port")
        .default(3000)
        .description("Port number")
        .schema(Commander.NumberFromString),
    )

    test.expect(cmd1.options.port.description).toBe("Port number")
    test.expect(cmd1.options.port.defaultValue).toBe(3000)
    test.expect(cmd2.options.port.description).toBe("Port number")
    test.expect(cmd2.options.port.defaultValue).toBe(3000)
  })

  test.it("should support method chaining with subcommands", () => {
    const sub1 = Commander.make({ name: "sub1" }).handle(() => Effect.void)

    const sub2 = Commander.make({ name: "sub2" }).handle(() => Effect.void)

    const cmd = Commander.make({ name: "app" })
      .option(Commander.option("--global").schema(Schema.String))
      .subcommand(sub1)
      .subcommand(sub2)
      .optionHelp()

    test.expect(cmd.options.global).toBeDefined()
    test.expect(cmd.options.help).toBeDefined()
    test.expect(cmd.subcommands.length).toBe(2)
  })
})

test.describe("example scenario", () => {
  test.it("should handle main command with subcommand", () =>
    Effect.gen(function* () {
      const unhandledFormat = Commander.make({
        name: "format",
        description: "Format source files",
      })

      const handledFormat = unhandledFormat
        .option(
          Commander.option("--style", "-s")
            .description("Code style to use")
            .default("standard")
            .schema(Schema.compose(Schema.String, Schema.Literal("standard", "prettier", "biome"))),
        )
        .handle((opts) => Effect.sync(() => ({ style: opts.style })))

      const main = Commander.make({
        name: "main",
        description: "this is doing that",
        version: "1.0.0",
      })
        .option(Commander.option("--source", "-s").schema(Schema.String))
        .option(
          Commander.option("--verbose", "-v")
            .description("Enable verbose output")
            .default(false)
            .schema(Schema.BooleanFromString),
        )
        .optionHelp()
        .subcommand(handledFormat)
        .handle((opts) => Effect.sync(() => opts))

      const resultMain = yield* Commander.parse(main, ["--source", "test.ts", "--verbose", "true"])

      test.expect(resultMain.source).toBe("test.ts")
      test.expect(resultMain.verbose).toBe(true)
      test.expect(resultMain.help).toBe(false)
      test.expect(main.subcommands.length).toBe(1)
      test.expect(main.subcommands[0]!.command.name).toBe("format")
      test.expect(main.subcommands[0]!.command.options.style).toBeDefined()
      test.expect(main.subcommands[0]!.command.options.style.defaultValue).toBe("standard")
    }).pipe(Effect.runPromise),
  )
})
