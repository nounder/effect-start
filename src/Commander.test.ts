import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Commander from "./Commander.ts"

t.describe("Commander", () => {
  t.describe("make", () => {
    t.it("should create a basic command", () => {
      const cmd = Commander.make({
        name: "test-app",
        description: "A test application"
      })
      t.expect(cmd.name).toBe("test-app")
      t.expect(cmd.description).toBe("A test application")
    })
  })

  t.describe("option - nested builder API", () => {
    t.it("should add an option with schema", () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--output")
            .short("-o")
            .schema(Schema.String)
        )

      t.expect(cmd.options["--output"]).toBeDefined()
      t.expect(cmd.options["--output"].long).toBe("--output")
      t.expect(cmd.options["--output"].short).toBe("o")
    })

    t.it("should add option with description", () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--output")
            .short("-o")
            .description("Output file")
            .schema(Schema.String)
        )

      t.expect(cmd.options["--output"].description).toBe("Output file")
    })

    t.it("should add option with default value", () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--count")
            .short("-c")
            .default(10)
            .schema(Commander.NumberFromString)
        )

      t.expect(cmd.options["--count"].defaultValue).toBe(10)
    })

    t.it("should chain multiple options", () => {
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

      t.expect(cmd.options["--input"]).toBeDefined()
      t.expect(cmd.options["--output"]).toBeDefined()
    })
  })

  t.describe("parse - kebab-to-camel conversion", () => {
    t.it("should convert kebab-case to camelCase", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--input-file")
            .schema(Schema.String)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--input-file", "test.txt"])
      )

      t.expect(result.inputFile).toBe("test.txt")
    })

    t.it("should handle single word options", async () => {
      const cmd = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--port")
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

    t.it("should use default value when option not provided", async () => {
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
  })

  t.describe("optionHelp", () => {
    t.it("should add help option", () => {
      const cmd = Commander
        .make({ name: "app" })
        .optionHelp()

      t.expect(cmd.options["--help"]).toBeDefined()
      t.expect(cmd.options["--help"].long).toBe("--help")
      t.expect(cmd.options["--help"].short).toBe("h")
    })
  })

  t.describe("optionVersion", () => {
    t.it("should add version option", () => {
      const cmd = Commander
        .make({ name: "app", version: "1.0.0" })
        .optionVersion()

      t.expect(cmd.options["--version"]).toBeDefined()
      t.expect(cmd.options["--version"].long).toBe("--version")
      t.expect(cmd.options["--version"].short).toBe("V")
    })
  })

  t.describe("handle", () => {
    t.it("should mark command as handled", () => {
      const handled = Commander
        .make({ name: "app" })
        .option(
          Commander
            .option("--name")
            .short("-n")
            .schema(Schema.String)
        )
        .handle((opts) => Effect.void)

      const unhandled = Commander
        .make({ name: "app2" })
        .option(
          Commander
            .option("--name")
            .short("-n")
            .schema(Schema.String)
        )

      t.expect(handled.handler).toBeDefined()
      t.expect(unhandled.handler).toBeUndefined()
    })
  })

  t.describe("subcommand", () => {
    t.it("should add subcommand", () => {
      const subCmd = Commander
        .make({ name: "format" })
        .option(
          Commander
            .option("--style")
            .schema(Schema.String)
        )
        .handle((opts) => Effect.void)

      const main = Commander
        .make({ name: "main" })
        .subcommand(subCmd)

      t.expect(main.subcommands.length).toBe(1)
      t.expect(main.subcommands[0]!.command.name).toBe("format")
    })
  })

  t.describe("help", () => {
    t.it("should generate help text", () => {
      const cmd = Commander
        .make({
          name: "myapp",
          description: "My awesome application",
          version: "1.0.0"
        })
        .option(
          Commander
            .option("--output")
            .short("-o")
            .description("Output file")
            .schema(Schema.String)
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
    t.it("should decode true values", async () => {
      const trueValues = ["true", "True", "TRUE", "1", "yes", "YES"]

      for (const val of trueValues) {
        const result = await Effect.runPromise(
          Schema.decode(Commander.BooleanFromString)(val)
        )
        t.expect(result).toBe(true)
      }
    })

    t.it("should decode false values", async () => {
      const falseValues = ["false", "False", "FALSE", "0", "no", "NO"]

      for (const val of falseValues) {
        const result = await Effect.runPromise(
          Schema.decode(Commander.BooleanFromString)(val)
        )
        t.expect(result).toBe(false)
      }
    })

    t.it("should fail on invalid boolean string", async () => {
      const result = await Effect.runPromise(
        Effect.either(Schema.decode(Commander.BooleanFromString)("invalid"))
      )

      t.expect(result._tag).toBe("Left")
    })
  })

  t.describe("choice", () => {
    t.it("should accept valid choice", async () => {
      const ColorSchema = Commander.choice(["red", "green", "blue"])

      const result = await Effect.runPromise(
        Schema.decode(ColorSchema)("red")
      )

      t.expect(result).toBe("red")
    })

    t.it("should fail on invalid choice", async () => {
      const ColorSchema = Commander.choice(["red", "green", "blue"])

      const result = await Effect.runPromise(
        Effect.either(Schema.decode(ColorSchema)("yellow"))
      )

      t.expect(result._tag).toBe("Left")
    })
  })

  t.describe("repeatable", () => {
    t.it("should parse comma-separated values", async () => {
      const schema = Commander.repeatable(Schema.String)

      const result = await Effect.runPromise(
        Schema.decode(schema)("foo,bar,baz")
      )

      t.expect(result).toEqual(["foo", "bar", "baz"])
    })

    t.it("should parse comma-separated numbers", async () => {
      const schema = Commander.repeatable(Commander.NumberFromString)

      const result = await Effect.runPromise(
        Schema.decode(schema)("1,2,3,4,5")
      )

      t.expect(result).toEqual([1, 2, 3, 4, 5])
    })

    t.it("should trim whitespace", async () => {
      const schema = Commander.repeatable(Schema.String)

      const result = await Effect.runPromise(
        Schema.decode(schema)("foo, bar , baz")
      )

      t.expect(result).toEqual(["foo", "bar", "baz"])
    })

    t.it("should encode back to string", async () => {
      const schema = Commander.repeatable(Schema.String)

      const result = await Effect.runPromise(
        Schema.encode(schema)(["foo", "bar", "baz"])
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
          version: "2.1.0"
        })
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
            .default("output.txt")
            .schema(Schema.String)
        )
        .option(
          Commander
            .option("--format")
            .short("-f")
            .default("json")
            .schema(Commander.choice(["json", "xml", "yaml"]))
        )
        .optionHelp()

      const result = await Effect.runPromise(
        Commander.parse(cmd, [
          "--input",
          "input.txt",
          "-f",
          "yaml"
        ])
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
            .schema(Commander.BooleanFromString)
        )
        .option(
          Commander
            .option("--cache-dir")
            .schema(Schema.String)
        )

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--dry-run", "true", "--cache-dir", "/tmp/cache"])
      )

      t.expect(result.dryRun).toBe(true)
      t.expect(result.cacheDir).toBe("/tmp/cache")
    })
  })
})
