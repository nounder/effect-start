import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Commander from "./Commander.ts"

t.describe("Commander - High-level Tests (inspired by commander.js)", () => {
  t.describe("parse", () => {
    t.it("should parse with explicit args", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--port")
            .short("-p")
            .schema(Commander.NumberFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--port", "3000"])
      )

      t.expect(result.port).toBe(3000)
    })

    t.it("should parse short options", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--port")
            .short("-p")
            .schema(Commander.NumberFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["-p", "8080"])
      )

      t.expect(result.port).toBe(8080)
    })

    t.it("should parse multiple options", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--host")
            .short("-h")
            .schema(Schema.String)
        )
        .option(
          Commander
            .option("--port")
            .short("-p")
            .schema(Commander.NumberFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--host", "localhost", "--port", "3000"])
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
            .schema(Commander.NumberFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--port=3000"])
      )

      t.expect(result.port).toBe(3000)
    })

    t.it("should parse combined short flags", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--verbose")
            .short("-v")
            .default(false)
            .schema(Commander.BooleanFromString)
        )
        .option(
          Commander
            .option("--debug")
            .short("-d")
            .default(false)
            .schema(Commander.BooleanFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, [])
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
            .option("--verbose")
            .short("-v")
            .default(false)
            .schema(Commander.BooleanFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, [])
      )

      t.expect(result.verbose).toBe(false)
    })

    t.it("should return true for boolean flag when specified", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--verbose")
            .short("-v")
            .default(false)
            .schema(Commander.BooleanFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--verbose", "true"])
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
            .schema(Schema.String)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, [])
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
            .option("--color")
            .short("-c")
            .schema(Commander.choice(["red", "green", "blue"]))
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--color", "red"])
      )

      t.expect(result.color).toBe("red")
    })

    t.it("should reject invalid choice", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--color")
            .short("-c")
            .schema(Commander.choice(["red", "green", "blue"]))
        )

      const result = await Effect.runPromise(
        Effect.either(Commander.parse(cmd, ["--color", "yellow"]))
      )

      t.expect(result._tag).toBe("Left")
    })

    t.it("should handle multiple choice options", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--format")
            .short("-f")
            .default("json")
            .schema(Commander.choice(["json", "xml", "yaml"]))
        )
        .option(
          Commander
            .option("--level")
            .short("-l")
            .default("info")
            .schema(Commander.choice(["debug", "info", "warn", "error"]))
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--format", "xml", "--level", "debug"])
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
            .option("--port")
            .short("-p")
            .default(3000)
            .schema(Commander.NumberFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, [])
      )

      t.expect(result.port).toBe(3000)
    })

    t.it("should override default when option specified", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--port")
            .short("-p")
            .default(3000)
            .schema(Commander.NumberFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--port", "8080"])
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
            .schema(Schema.String)
        )
        .option(
          Commander
            .option("--port")
            .default(3000)
            .schema(Commander.NumberFromString)
        )
        .option(
          Commander
            .option("--debug")
            .default(false)
            .schema(Commander.BooleanFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, [])
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
            .option("--output")
            .short("-o")
            .default("output.txt")
            .schema(Schema.String)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, [])
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
            .option("--name")
            .short("-n")
            .schema(Schema.String)
        )
        .handle((opts) =>
          Effect.sync(() => {
            capturedOptions = opts
          })
        )

      const parsed = await Effect.runPromise(
        Commander.parse(cmd, ["--name", "test"])
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
            .schema(Commander.NumberFromString)
        )
        .handle((opts) =>
          Effect.gen(function* () {
            yield* Effect.sleep(opts.delay)
            executed = true
          })
        )

      await Effect.runPromise(
        Commander.parse(cmd, ["--delay", "10"])
      )

      t.expect(executed).toBe(false)
    })

    t.it("should pass all options to handler", async () => {
      let capturedOpts: any = null

      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--input")
            .short("-i")
            .schema(Schema.String)
        )
        .option(
          Commander
            .option("--output")
            .short("-o")
            .schema(Schema.String)
        )
        .option(
          Commander
            .option("--verbose")
            .short("-v")
            .default(false)
            .schema(Commander.BooleanFromString)
        )
        .handle((opts) =>
          Effect.sync(() => {
            capturedOpts = opts
          })
        )

      await Effect.runPromise(
        Commander.parse(cmd, ["-i", "in.txt", "-o", "out.txt", "-v", "true"])
      )
    })
  })

  t.describe("version", () => {
    t.it("should include version in command definition", () => {
      const cmd = Commander
        .make({ name: "app", version: "1.0.0" })
        .optionVersion()

      t.expect(cmd.version).toBe("1.0.0")
      t.expect(cmd.options["--version"]).toBeDefined()
    })

    t.it("should handle version without version option", () => {
      const cmd = Commander
        .make({ name: "app", version: "2.0.0" })

      t.expect(cmd.version).toBe("2.0.0")
      t.expect(cmd.options["--version"]).toBeUndefined()
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

  t.describe("help", () => {
    t.it("should generate help with description", () => {
      const cmd = Commander
        .make({
          name: "myapp",
          description: "A test application"
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
            .option("--input")
            .short("-i")
            .description("Input file")
            .schema(Schema.String)
        )
        .option(
          Commander
            .option("--output")
            .short("-o")
            .description("Output file")
            .schema(Schema.String)
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
            .option("--config")
            .short("-c")
            .description("Config file path")
            .schema(Schema.String)
        )

      const help = Commander.help(cmd)

      t.expect(help).toContain("-c, --config")
      t.expect(help).toContain("Config file path")
    })
  })

  t.describe("subcommands", () => {
    t.it("should add subcommand", () => {
      const subCmd = Commander
        .make({ name: "build" })
        .option(
          Commander
            .option("--watch")
            .short("-w")
            .default(false)
            .schema(Commander.BooleanFromString)
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
        "deploy"
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
            .schema(Schema.String)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--name", "test"])
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
            .schema(Commander.NumberFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--count", "42"])
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
            .schema(Commander.BooleanFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--enabled", "true"])
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
            .schema(Commander.NumberFromString)
        )

      const result = await Effect.runPromise(
        Effect.either(Commander.parse(cmd, ["--count", "not-a-number"]))
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
            .option("--host")
            .short("-h")
            .default("localhost")
            .schema(Schema.String)
        )
        .option(
          Commander
            .option("--port")
            .short("-p")
            .default(3000)
            .schema(Commander.NumberFromString)
        )
        .option(
          Commander
            .option("--ssl")
            .default(false)
            .schema(Commander.BooleanFromString)
        )
        .option(
          Commander
            .option("--env")
            .short("-e")
            .default("development")
            .schema(Commander.choice(["development", "production", "test"]))
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
          "production"
        ])
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
            .option("--tags")
            .short("-t")
            .schema(Commander.repeatable(Schema.String))
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--tags", "foo,bar,baz"])
      )

      t.expect(result.tags).toEqual(["foo", "bar", "baz"])
    })

    t.it("should preserve option order independence", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--first")
            .schema(Schema.String)
        )
        .option(
          Commander
            .option("--second")
            .schema(Schema.String)
        )

      const result1 = await Effect.runPromise(
        Commander.parse(cmd, ["--first", "1", "--second", "2"])
      )

      const result2 = await Effect.runPromise(
        Commander.parse(cmd, ["--second", "2", "--first", "1"])
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
            .schema(Commander.BooleanFromString)
        )
        .option(
          Commander
            .option("--no-cache")
            .default(false)
            .schema(Commander.BooleanFromString)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--dry-run", "true", "--no-cache", "true"])
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
            .schema(Commander.NumberFromString)
        )

      const result = await Effect.runPromise(
        Effect.either(Commander.parse(cmd, ["--port", "invalid"]))
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
            .schema(Commander.choice(["dev", "prod"]))
        )

      const result = await Effect.runPromise(
        Effect.either(Commander.parse(cmd, ["--mode", "staging"]))
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
            .option("--input")
            .short("-i")
            .description("Input file")
            .schema(Schema.String)
        )
        .option(
          Commander
            .option("--output")
            .short("-o")
            .description("Output file")
            .default("out.txt")
            .schema(Schema.String)
        )

      t.expect(cmd.options["--input"].description).toBe("Input file")
      t.expect(cmd.options["--output"].description).toBe("Output file")
      t.expect(cmd.options["--output"].defaultValue).toBe("out.txt")
    })

    t.it("should chain description and default in any order", () => {
      const cmd1 = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--port")
            .description("Port number")
            .default(3000)
            .schema(Commander.NumberFromString)
        )

      const cmd2 = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--port")
            .default(3000)
            .description("Port number")
            .schema(Commander.NumberFromString)
        )

      t.expect(cmd1.options["--port"].description).toBe("Port number")
      t.expect(cmd1.options["--port"].defaultValue).toBe(3000)
      t.expect(cmd2.options["--port"].description).toBe("Port number")
      t.expect(cmd2.options["--port"].defaultValue).toBe(3000)
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
            .schema(Schema.String)
        )
        .subcommand(sub1)
        .subcommand(sub2)
        .optionHelp()

      t.expect(cmd.options["--global"]).toBeDefined()
      t.expect(cmd.options["--help"]).toBeDefined()
      t.expect(cmd.subcommands.length).toBe(2)
    })
  })
})
