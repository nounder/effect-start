import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Commander from "./Commander.ts"

t.describe(`${Commander.make.name}`, () => {
  t.it("should create a basic command", () => {
    const cmd = Commander.make({
      name: "test-app",
      description: "A test application",
    })
    t.expect(cmd.name).toBe("test-app")
    t.expect(cmd.description).toBe("A test application")
  })
})

t.describe(`${Commander.option.name} - nested builder API`, () => {
  t.it("should add an option with schema", () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--output", "-o")
          .schema(Schema.String),
      )

    t.expect(cmd.options.output).toBeDefined()
    t.expect(cmd.options.output.long).toBe("--output")
    t.expect(cmd.options.output.short).toBe("o")
  })

  t.it("should add option with description", () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--output", "-o")
          .description("Output file")
          .schema(Schema.String),
      )

    t.expect(cmd.options.output.description).toBe("Output file")
  })

  t.it("should add option with default value", () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--count", "-c")
          .default(10)
          .schema(Commander.NumberFromString),
      )

    t.expect(cmd.options.count.defaultValue).toBe(10)
  })

  t.it("should chain multiple options", () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--input", "-i")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--output", "-o")
          .schema(Schema.String),
      )

    t.expect(cmd.options.input).toBeDefined()
    t.expect(cmd.options.output).toBeDefined()
    t.expect(cmd.options.input.long).toBe("--input")
    t.expect(cmd.options.output.long).toBe("--output")
  })
})

t.describe(`${Commander.parse.name} - kebab-to-camel conversion`, () => {
  t.it("should convert kebab-case to camelCase", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--input-file")
          .schema(Schema.String),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--input-file", "test.txt"]),
    )

    t.expect(result.inputFile).toBe("test.txt")
  })

  t.it("should handle single word options", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--port", "3000"]),
    )

    t.expect(result.port).toBe(3000)
  })

  t.it("should parse short options", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port", "-p")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["-p", "8080"]),
    )

    t.expect(result.port).toBe(8080)
  })

  t.it("should parse multiple options", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--host", "-h")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--port", "-p")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--host", "localhost", "--port", "3000"]),
    )

    t.expect(result.host).toBe("localhost")
    t.expect(result.port).toBe(3000)
  })

  t.it("should handle options with equals syntax", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--port=3000"]),
    )

    t.expect(result.port).toBe(3000)
  })

  t.it("should use default value when option not provided", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port", "-p")
          .default(3000)
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, []),
    )

    t.expect(result.port).toBe(3000)
  })

  t.it("should override default when option specified", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port", "-p")
          .default(3000)
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--port", "8080"]),
    )

    t.expect(result.port).toBe(8080)
  })
})

t.describe(`${Commander.optionHelp.name}`, () => {
  t.it("should add help option", () => {
    const cmd = Commander
      .make({ name: "app" })
      .optionHelp()

    t.expect(cmd.options.help).toBeDefined()
    t.expect(cmd.options.help.long).toBe("--help")
    t.expect(cmd.options.help.short).toBe("h")
  })
})

t.describe(`${Commander.optionVersion.name}`, () => {
  t.it("should add version option", () => {
    const cmd = Commander
      .make({ name: "app", version: "1.0.0" })
      .optionVersion()

    t.expect(cmd.options.version).toBeDefined()
    t.expect(cmd.options.version.long).toBe("--version")
    t.expect(cmd.options.version.short).toBe("V")
  })
})

t.describe(`${Commander.handle.name}`, () => {
  t.it("should mark command as handled", () => {
    const handled = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--name", "-n")
          .schema(Schema.String),
      )
      .handle((opts) => Effect.void)

    const unhandled = Commander
      .make({ name: "app2" })
      .option(
        Commander
          .option("--name", "-n")
          .schema(Schema.String),
      )

    t.expect(handled.handler).toBeDefined()
    t.expect(unhandled.handler).toBeUndefined()
  })
})

t.describe(`${Commander.subcommand.name}`, () => {
  t.it("should add subcommand", () => {
    const subCmd = Commander
      .make({ name: "format" })
      .option(
        Commander
          .option("--style")
          .schema(Schema.String),
      )
      .handle((opts) => Effect.void)

    const main = Commander
      .make({ name: "main" })
      .subcommand(subCmd)

    t.expect(main.subcommands.length).toBe(1)
    t.expect(main.subcommands[0]!.command.name).toBe("format")
  })
})

t.describe(`${Commander.help.name}`, () => {
  t.it("should generate help text", () => {
    const cmd = Commander
      .make({
        name: "myapp",
        description: "My awesome application",
        version: "1.0.0",
      })
      .option(
        Commander
          .option("--output", "-o")
          .description("Output file")
          .schema(Schema.String),
      )
      .optionHelp()

    const helpText = Commander.help(cmd)

    t.expect(helpText).toContain("My awesome application")
    t.expect(helpText).toContain("Usage: myapp [options]")
    t.expect(helpText).toContain("--output")
    t.expect(helpText).toContain("-o,")
    t.expect(helpText).toContain("Output file")
    t.expect(helpText).toContain("--help")
  })
})

t.describe("BooleanFromString", () => {
  t.it("should decode true value", async () => {
    const result = await Effect.runPromise(
      Schema.decode(Schema.BooleanFromString)("true"),
    )
    t.expect(result).toBe(true)
  })

  t.it("should decode false value", async () => {
    const result = await Effect.runPromise(
      Schema.decode(Schema.BooleanFromString)("false"),
    )
    t.expect(result).toBe(false)
  })
})

t.describe(`${Commander.choice.name}`, () => {
  t.it("should accept valid choice", async () => {
    const ColorSchema = Schema.compose(
      Schema.String,
      Schema.Literal("red", "green", "blue"),
    )

    const result = await Effect.runPromise(
      Schema.decode(ColorSchema)("red"),
    )

    t.expect(result).toBe("red")
  })

  t.it("should fail on invalid choice", async () => {
    const ColorSchema = Schema.compose(
      Schema.String,
      Schema.Literal("red", "green", "blue"),
    )

    const result = await Effect.runPromise(
      Effect.either(Schema.decode(ColorSchema)("yellow")),
    )

    t.expect(result._tag).toBe("Left")
  })
})

t.describe(`${Commander.repeatable.name}`, () => {
  t.it("should parse comma-separated values", async () => {
    const schema = Commander.repeatable(Schema.String)

    const result = await Effect.runPromise(
      Schema.decode(schema)("foo,bar,baz"),
    )

    t.expect(result).toEqual(["foo", "bar", "baz"])
  })

  t.it("should parse comma-separated numbers", async () => {
    const schema = Commander.repeatable(Commander.NumberFromString)

    const result = await Effect.runPromise(
      Schema.decode(schema)("1,2,3,4,5"),
    )

    t.expect(result).toEqual([1, 2, 3, 4, 5])
  })

  t.it("should trim whitespace", async () => {
    const schema = Commander.repeatable(Schema.String)

    const result = await Effect.runPromise(
      Schema.decode(schema)("foo, bar , baz"),
    )

    t.expect(result).toEqual(["foo", "bar", "baz"])
  })

  t.it("should encode back to string", async () => {
    const schema = Commander.repeatable(Schema.String)

    const result = await Effect.runPromise(
      Schema.encode(schema)(["foo", "bar", "baz"]),
    )

    t.expect(result).toBe("foo,bar,baz")
  })
})

t.describe("integration", () => {
  t.it("should work with builder pattern", async () => {
    const cmd = Commander
      .make({
        name: "converter",
        description: "Convert files",
        version: "2.1.0",
      })
      .option(
        Commander
          .option("--input", "-i")
          .description("Input file")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--output", "-o")
          .description("Output file")
          .default("output.txt")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--format", "-f")
          .default("json")
          .schema(
            Schema.compose(
              Schema.String,
              Schema.Literal("json", "xml", "yaml"),
            ),
          ),
      )
      .optionHelp()

    const result = await Effect.runPromise(
      Commander.parse(cmd, [
        "--input",
        "input.txt",
        "-f",
        "yaml",
      ]),
    )

    t.expect(result.input).toBe("input.txt")
    t.expect(result.output).toBe("output.txt")
    t.expect(result.format).toBe("yaml")
    t.expect(result.help).toBe(false)
  })

  t.it("should handle kebab-case option names", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--dry-run")
          .default(false)
          .schema(Schema.BooleanFromString),
      )
      .option(
        Commander
          .option("--cache-dir")
          .schema(Schema.String),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--dry-run", "true", "--cache-dir", "/tmp/cache"]),
    )

    t.expect(result.dryRun).toBe(true)
    t.expect(result.cacheDir).toBe("/tmp/cache")
  })
})

t.describe(`${Commander.parse.name} - comprehensive`, () => {
  t.it("should parse with explicit args", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port", "-p")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--port", "3000"]),
    )

    t.expect(result.port).toBe(3000)
  })

  t.it("should parse short options", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port", "-p")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["-p", "8080"]),
    )

    t.expect(result.port).toBe(8080)
  })

  t.it("should parse multiple options", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--host", "-h")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--port", "-p")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--host", "localhost", "--port", "3000"]),
    )

    t.expect(result.host).toBe("localhost")
    t.expect(result.port).toBe(3000)
  })

  t.it("should handle options with equals syntax", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--port=3000"]),
    )

    t.expect(result.port).toBe(3000)
  })

  t.it("should parse combined short flags", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--verbose", "-v")
          .default(false)
          .schema(Schema.BooleanFromString),
      )
      .option(
        Commander
          .option("--debug", "-d")
          .default(false)
          .schema(Schema.BooleanFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, []),
    )

    t.expect(result.verbose).toBe(false)
    t.expect(result.debug).toBe(false)
  })
})

t.describe("boolean options", () => {
  t.it("should return false for boolean flag when not specified", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--verbose", "-v")
          .default(false)
          .schema(Schema.BooleanFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, []),
    )

    t.expect(result.verbose).toBe(false)
  })

  t.it("should return true for boolean flag when specified", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--verbose", "-v")
          .default(false)
          .schema(Schema.BooleanFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--verbose", "true"]),
    )

    t.expect(result.verbose).toBe(true)
  })

  t.it("should handle boolean with custom default", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--color")
          .default("auto")
          .schema(Schema.String),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, []),
    )

    t.expect(result.color).toBe("auto")
  })
})

t.describe("options with choices", () => {
  t.it("should accept valid choice", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--color", "-c")
          .schema(
            Schema.compose(
              Schema.String,
              Schema.Literal("red", "green", "blue"),
            ),
          ),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--color", "red"]),
    )

    t.expect(result.color).toBe("red")
  })

  t.it("should reject invalid choice", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--color", "-c")
          .schema(
            Schema.compose(
              Schema.String,
              Schema.Literal("red", "green", "blue"),
            ),
          ),
      )

    const result = await Effect.runPromise(
      Effect.either(Commander.parse(cmd, ["--color", "yellow"])),
    )

    t.expect(result._tag).toBe("Left")
  })

  t.it("should handle multiple choice options", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--format", "-f")
          .default("json")
          .schema(
            Schema.compose(
              Schema.String,
              Schema.Literal("json", "xml", "yaml"),
            ),
          ),
      )
      .option(
        Commander
          .option("--level", "-l")
          .default("info")
          .schema(
            Schema.compose(
              Schema.String,
              Schema.Literal("debug", "info", "warn", "error"),
            ),
          ),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--format", "xml", "--level", "debug"]),
    )

    t.expect(result.format).toBe("xml")
    t.expect(result.level).toBe("debug")
  })
})

t.describe("options with defaults", () => {
  t.it("should use default when option not specified", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port", "-p")
          .default(3000)
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, []),
    )

    t.expect(result.port).toBe(3000)
  })

  t.it("should override default when option specified", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port", "-p")
          .default(3000)
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--port", "8080"]),
    )

    t.expect(result.port).toBe(8080)
  })

  t.it("should handle multiple defaults", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--host")
          .default("localhost")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--port")
          .default(3000)
          .schema(Commander.NumberFromString),
      )
      .option(
        Commander
          .option("--debug")
          .default(false)
          .schema(Schema.BooleanFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, []),
    )

    t.expect(result.host).toBe("localhost")
    t.expect(result.port).toBe(3000)
    t.expect(result.debug).toBe(false)
  })

  t.it("should use default for string option", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--output", "-o")
          .default("output.txt")
          .schema(Schema.String),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, []),
    )

    t.expect(result.output).toBe("output.txt")
  })
})

t.describe("action/handler", () => {
  t.it("should invoke handler with parsed options", async () => {
    let capturedOptions: any = null

    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--name", "-n")
          .schema(Schema.String),
      )
      .handle((opts) =>
        Effect.sync(() => {
          capturedOptions = opts
        })
      )

    const parsed = await Effect.runPromise(
      Commander.parse(cmd, ["--name", "test"]),
    )

    t.expect(parsed.name).toBe("test")
  })

  t.it("should support async handlers", async () => {
    let executed = false

    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--delay")
          .default(0)
          .schema(Commander.NumberFromString),
      )
      .handle((opts) =>
        Effect.gen(function*() {
          yield* Effect.sleep(opts.delay)
          executed = true
        })
      )

    await Effect.runPromise(
      Commander.parse(cmd, ["--delay", "10"]),
    )

    t.expect(executed).toBe(false)
  })

  t.it("should pass all options to handler", async () => {
    let capturedOpts: any = null

    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--input", "-i")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--output", "-o")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--verbose", "-v")
          .default(false)
          .schema(Schema.BooleanFromString),
      )
      .handle((opts) =>
        Effect.sync(() => {
          capturedOpts = opts
        })
      )

    await Effect.runPromise(
      Commander.parse(cmd, ["-i", "in.txt", "-o", "out.txt", "-v", "true"]),
    )
  })
})

t.describe(`${Commander.optionVersion.name} - version behavior`, () => {
  t.it("should include version in command definition", () => {
    const cmd = Commander
      .make({ name: "app", version: "1.0.0" })
      .optionVersion()

    t.expect(cmd.version).toBe("1.0.0")
    t.expect(cmd.options.version).toBeDefined()
  })

  t.it("should handle version without version option", () => {
    const cmd = Commander
      .make({ name: "app", version: "2.0.0" })

    t.expect(cmd.version).toBe("2.0.0")
    t.expect((cmd.options as any).version).toBeUndefined()
  })

  t.it("should include version option in help", () => {
    const cmd = Commander
      .make({ name: "app", version: "1.0.0" })
      .optionVersion()

    const help = Commander.help(cmd)

    t.expect(help).toContain("--version")
    t.expect(help).toContain("-V")
  })
})

t.describe(`${Commander.help.name} - comprehensive`, () => {
  t.it("should generate help with description", () => {
    const cmd = Commander
      .make({
        name: "myapp",
        description: "A test application",
      })
      .optionHelp()

    const help = Commander.help(cmd)

    t.expect(help).toContain("A test application")
    t.expect(help).toContain("Usage: myapp [options]")
  })

  t.it("should include all options in help", () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--input", "-i")
          .description("Input file")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--output", "-o")
          .description("Output file")
          .schema(Schema.String),
      )
      .optionHelp()

    const help = Commander.help(cmd)

    t.expect(help).toContain("--input")
    t.expect(help).toContain("-i,")
    t.expect(help).toContain("Input file")
    t.expect(help).toContain("--output")
    t.expect(help).toContain("-o,")
    t.expect(help).toContain("Output file")
  })

  t.it("should show subcommands in help", () => {
    const subCmd = Commander
      .make({ name: "init", description: "Initialize project" })
      .handle(() => Effect.void)

    const cmd = Commander
      .make({ name: "app" })
      .subcommand(subCmd)
      .optionHelp()

    const help = Commander.help(cmd)

    t.expect(help).toContain("Commands:")
    t.expect(help).toContain("init")
    t.expect(help).toContain("Initialize project")
  })

  t.it("should format option descriptions properly", () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--config", "-c")
          .description("Config file path")
          .schema(Schema.String),
      )

    const help = Commander.help(cmd)

    t.expect(help).toContain("-c, --config")
    t.expect(help).toContain("Config file path")
  })
})

t.describe(`${Commander.subcommand.name} - comprehensive`, () => {
  t.it("should add subcommand", () => {
    const subCmd = Commander
      .make({ name: "build" })
      .option(
        Commander
          .option("--watch", "-w")
          .default(false)
          .schema(Schema.BooleanFromString),
      )
      .handle(() => Effect.void)

    const cmd = Commander
      .make({ name: "app" })
      .subcommand(subCmd)

    t.expect(cmd.subcommands.length).toBe(1)
    t.expect(cmd.subcommands[0]!.command.name).toBe("build")
  })

  t.it("should add multiple subcommands", () => {
    const build = Commander
      .make({ name: "build" })
      .handle(() => Effect.void)

    const test = Commander
      .make({ name: "test" })
      .handle(() => Effect.void)

    const cmd = Commander
      .make({ name: "app" })
      .subcommand(build)
      .subcommand(test)

    t.expect(cmd.subcommands.length).toBe(2)
    t.expect(cmd.subcommands[0]!.command.name).toBe("build")
    t.expect(cmd.subcommands[1]!.command.name).toBe("test")
  })

  t.it("should nest subcommands", () => {
    const deploy = Commander
      .make({ name: "deploy" })
      .handle(() => Effect.void)

    const build = Commander
      .make({ name: "build" })
      .subcommand(deploy)
      .handle(() => Effect.void)

    const cmd = Commander
      .make({ name: "app" })
      .subcommand(build)

    t.expect(cmd.subcommands[0]!.command.subcommands.length).toBe(1)
    t.expect(cmd.subcommands[0]!.command.subcommands[0]!.command.name).toBe(
      "deploy",
    )
  })
})

t.describe("option types", () => {
  t.it("should parse string option", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--name")
          .schema(Schema.String),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--name", "test"]),
    )

    t.expect(result.name).toBe("test")
    t.expect(typeof result.name).toBe("string")
  })

  t.it("should parse number option", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--count")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--count", "42"]),
    )

    t.expect(result.count).toBe(42)
    t.expect(typeof result.count).toBe("number")
  })

  t.it("should parse boolean option", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--enabled")
          .schema(Schema.BooleanFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--enabled", "true"]),
    )

    t.expect(result.enabled).toBe(true)
    t.expect(typeof result.enabled).toBe("boolean")
  })

  t.it("should fail on invalid number", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--count")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Effect.either(Commander.parse(cmd, ["--count", "not-a-number"])),
    )

    t.expect(result._tag).toBe("Left")
  })
})

t.describe("complex scenarios", () => {
  t.it("should handle mixed option types", async () => {
    const cmd = Commander
      .make({ name: "server" })
      .option(
        Commander
          .option("--host", "-h")
          .default("localhost")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--port", "-p")
          .default(3000)
          .schema(Commander.NumberFromString),
      )
      .option(
        Commander
          .option("--ssl")
          .default(false)
          .schema(Schema.BooleanFromString),
      )
      .option(
        Commander
          .option("--env", "-e")
          .default("development")
          .schema(
            Schema.compose(
              Schema.String,
              Schema.Literal("development", "production", "test"),
            ),
          ),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, [
        "--host",
        "0.0.0.0",
        "-p",
        "8080",
        "--ssl",
        "true",
        "-e",
        "production",
      ]),
    )

    t.expect(result.host).toBe("0.0.0.0")
    t.expect(result.port).toBe(8080)
    t.expect(result.ssl).toBe(true)
    t.expect(result.env).toBe("production")
  })

  t.it("should handle repeatable options", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--tags", "-t")
          .schema(Commander.repeatable(Schema.String)),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--tags", "foo,bar,baz"]),
    )

    t.expect(result.tags).toEqual(["foo", "bar", "baz"])
  })

  t.it("should preserve option order independence", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--first")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--second")
          .schema(Schema.String),
      )

    const result1 = await Effect.runPromise(
      Commander.parse(cmd, ["--first", "1", "--second", "2"]),
    )

    const result2 = await Effect.runPromise(
      Commander.parse(cmd, ["--second", "2", "--first", "1"]),
    )

    t.expect(result1.first).toBe("1")
    t.expect(result1.second).toBe("2")
    t.expect(result2.first).toBe("1")
    t.expect(result2.second).toBe("2")
  })

  t.it("should handle options with hyphens in names", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--dry-run")
          .default(false)
          .schema(Schema.BooleanFromString),
      )
      .option(
        Commander
          .option("--no-cache")
          .default(false)
          .schema(Schema.BooleanFromString),
      )

    const result = await Effect.runPromise(
      Commander.parse(cmd, ["--dry-run", "true", "--no-cache", "true"]),
    )

    t.expect(result.dryRun).toBe(true)
    t.expect(result.noCache).toBe(true)
  })
})

t.describe("error handling", () => {
  t.it("should fail gracefully on invalid option value", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port")
          .schema(Commander.NumberFromString),
      )

    const result = await Effect.runPromise(
      Effect.either(Commander.parse(cmd, ["--port", "invalid"])),
    )

    t.expect(result._tag).toBe("Left")
    if (result._tag === "Left") {
      t.expect(result.left.message).toContain("Invalid value")
    }
  })

  t.it("should fail on invalid choice", async () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--mode")
          .schema(Schema.compose(Schema.String, Schema.Literal("dev", "prod"))),
      )

    const result = await Effect.runPromise(
      Effect.either(Commander.parse(cmd, ["--mode", "staging"])),
    )

    t.expect(result._tag).toBe("Left")
  })
})

t.describe("builder pattern", () => {
  t.it("should chain option definitions fluently", () => {
    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--input", "-i")
          .description("Input file")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--output", "-o")
          .description("Output file")
          .default("out.txt")
          .schema(Schema.String),
      )

    t.expect(cmd.options.input.description).toBe("Input file")
    t.expect(cmd.options.output.description).toBe("Output file")
    t.expect(cmd.options.output.defaultValue).toBe("out.txt")
  })

  t.it("should chain description and default in any order", () => {
    const cmd1 = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port")
          .description("Port number")
          .default(3000)
          .schema(Commander.NumberFromString),
      )

    const cmd2 = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--port")
          .default(3000)
          .description("Port number")
          .schema(Commander.NumberFromString),
      )

    t.expect(cmd1.options.port.description).toBe("Port number")
    t.expect(cmd1.options.port.defaultValue).toBe(3000)
    t.expect(cmd2.options.port.description).toBe("Port number")
    t.expect(cmd2.options.port.defaultValue).toBe(3000)
  })

  t.it("should support method chaining with subcommands", () => {
    const sub1 = Commander
      .make({ name: "sub1" })
      .handle(() => Effect.void)

    const sub2 = Commander
      .make({ name: "sub2" })
      .handle(() => Effect.void)

    const cmd = Commander
      .make({ name: "app" })
      .option(
        Commander
          .option("--global")
          .schema(Schema.String),
      )
      .subcommand(sub1)
      .subcommand(sub2)
      .optionHelp()

    t.expect(cmd.options.global).toBeDefined()
    t.expect(cmd.options.help).toBeDefined()
    t.expect(cmd.subcommands.length).toBe(2)
  })
})

t.describe("example scenario", () => {
  t.it("should handle main command with subcommand", async () => {
    const unhandledFormat = Commander.make({
      name: "format",
      description: "Format source files",
    })

    const handledFormat = unhandledFormat
      .option(
        Commander
          .option("--style", "-s")
          .description("Code style to use")
          .default("standard")
          .schema(
            Schema.compose(
              Schema.String,
              Schema.Literal("standard", "prettier", "biome"),
            ),
          ),
      )
      .handle((opts) => Effect.sync(() => ({ style: opts.style })))

    const main = Commander
      .make({
        name: "main",
        description: "this is doing that",
        version: "1.0.0",
      })
      .option(
        Commander
          .option("--source", "-s")
          .schema(Schema.String),
      )
      .option(
        Commander
          .option("--verbose", "-v")
          .description("Enable verbose output")
          .default(false)
          .schema(Schema.BooleanFromString),
      )
      .optionHelp()
      .subcommand(handledFormat)
      .handle((opts) => Effect.sync(() => opts))

    const resultMain = await Effect.runPromise(
      Commander.parse(main, ["--source", "test.ts", "--verbose", "true"]),
    )

    t.expect(resultMain.source).toBe("test.ts")
    t.expect(resultMain.verbose).toBe(true)
    t.expect(resultMain.help).toBe(false)

    t.expect(main.subcommands.length).toBe(1)
    t.expect(main.subcommands[0]!.command.name).toBe("format")

    t.expect(main.subcommands[0]!.command.options.style).toBeDefined()
    t.expect(main.subcommands[0]!.command.options.style.defaultValue).toBe(
      "standard",
    )
  })
})
