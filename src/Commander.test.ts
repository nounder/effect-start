import * as t from "bun:test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Commander from "./Commander.ts"

t.describe("Commander", () => {
  t.describe("flag", () => {
    t.it("should create a flag with long name", () => {
      const flag = Commander.flag("verbose")
      t.expect(flag._tag).toBe("Flag")
      t.expect(flag.long).toBe("verbose")
      t.expect(flag.short).toBeUndefined()
      t.expect(flag.description).toBe("")
    })

    t.it("should create a flag with short and long names", () => {
      const flag = Commander.flag("verbose", {
        short: "v",
        description: "Enable verbose output"
      })
      t.expect(flag.long).toBe("verbose")
      t.expect(flag.short).toBe("v")
      t.expect(flag.description).toBe("Enable verbose output")
    })
  })

  t.describe("option", () => {
    t.it("should create an option with schema", () => {
      const opt = Commander.option("output", Schema.String)
      t.expect(opt._tag).toBe("OptionDef")
      t.expect(opt.long).toBe("output")
      t.expect(opt.short).toBeUndefined()
    })

    t.it("should create an option with default value", () => {
      const opt = Commander.option("count", Commander.NumberFromString, {
        defaultValue: 10
      })
      t.expect(opt.defaultValue).toBe(10)
    })
  })

  t.describe("argument", () => {
    t.it("should create a required argument", () => {
      const arg = Commander.argument("input", Schema.String)
      t.expect(arg._tag).toBe("Argument")
      t.expect(arg.name).toBe("input")
      t.expect(arg.optional).toBe(false)
    })

    t.it("should create an optional argument", () => {
      const arg = Commander.argument("output", Schema.String, {
        optional: true
      })
      t.expect(arg.optional).toBe(true)
    })
  })

  t.describe("command", () => {
    t.it("should create a basic command", () => {
      const cmd = Commander.command({
        name: "test-app",
        description: "A test application"
      })
      t.expect(cmd.name).toBe("test-app")
      t.expect(cmd.description).toBe("A test application")
    })

    t.it("should create a command with flags", () => {
      const cmd = Commander.command<{ verbose: boolean }, []>({
        name: "app",
        options: {
          verbose: Commander.flag("verbose", { short: "v" })
        }
      })
      t.expect(cmd.flagsMap.get("verbose")).toBe("verbose")
      t.expect(cmd.flagsMap.get("v")).toBe("verbose")
    })

    t.it("should create a command with options", () => {
      const cmd = Commander.command<{ output: string }, []>({
        name: "app",
        options: {
          output: Commander.option("output", Schema.String, { short: "o" })
        }
      })
      t.expect(cmd.optionsMap.get("output")?.key).toBe("output")
      t.expect(cmd.optionsMap.get("o")?.key).toBe("output")
    })

    t.it("should create a command with arguments", () => {
      const cmd = Commander.command({
        name: "app",
        arguments: [
          Commander.argument("input", Schema.String),
          Commander.argument("output", Schema.String, { optional: true })
        ]
      })
      t.expect(cmd.arguments.length).toBe(2)
      t.expect(cmd.arguments[0]!.name).toBe("input")
      t.expect(cmd.arguments[1]!.optional).toBe(true)
    })
  })

  t.describe("parse", () => {
    t.it("should parse flags", async () => {
      const cmd = Commander.command<{ verbose: boolean; debug: boolean }, []>({
        name: "app",
        options: {
          verbose: Commander.flag("verbose", { short: "v" }),
          debug: Commander.flag("debug", { short: "d" })
        }
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--verbose", "-d"])
      )

      t.expect(result.options.verbose).toBe(true)
      t.expect(result.options.debug).toBe(true)
    })

    t.it("should parse flags with false default", async () => {
      const cmd = Commander.command<{ verbose: boolean }, []>({
        name: "app",
        options: {
          verbose: Commander.flag("verbose")
        }
      })

      const result = await Effect.runPromise(Commander.parse(cmd, []))

      t.expect(result.options.verbose).toBe(false)
    })

    t.it("should parse long options with equals", async () => {
      const cmd = Commander.command<{ output: string }, []>({
        name: "app",
        options: {
          output: Commander.option("output", Schema.String)
        }
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--output=file.txt"])
      )

      t.expect(result.options.output).toBe("file.txt")
    })

    t.it("should parse long options with space", async () => {
      const cmd = Commander.command<{ output: string }, []>({
        name: "app",
        options: {
          output: Commander.option("output", Schema.String)
        }
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--output", "file.txt"])
      )

      t.expect(result.options.output).toBe("file.txt")
    })

    t.it("should parse short options", async () => {
      const cmd = Commander.command<{ output: string }, []>({
        name: "app",
        options: {
          output: Commander.option("output", Schema.String, { short: "o" })
        }
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["-o", "file.txt"])
      )

      t.expect(result.options.output).toBe("file.txt")
    })

    t.it("should parse multiple short flags together", async () => {
      const cmd = Commander.command<
        { verbose: boolean; debug: boolean; quiet: boolean },
        []
      >({
        name: "app",
        options: {
          verbose: Commander.flag("verbose", { short: "v" }),
          debug: Commander.flag("debug", { short: "d" }),
          quiet: Commander.flag("quiet", { short: "q" })
        }
      })

      const result = await Effect.runPromise(Commander.parse(cmd, ["-vdq"]))

      t.expect(result.options.verbose).toBe(true)
      t.expect(result.options.debug).toBe(true)
      t.expect(result.options.quiet).toBe(true)
    })

    t.it("should parse positional arguments", async () => {
      const cmd = Commander.command<{}, [string, string]>({
        name: "app",
        arguments: [
          Commander.argument("input", Schema.String),
          Commander.argument("output", Schema.String)
        ]
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["input.txt", "output.txt"])
      )

      t.expect(result.arguments[0]).toBe("input.txt")
      t.expect(result.arguments[1]).toBe("output.txt")
    })

    t.it("should parse optional arguments", async () => {
      const cmd = Commander.command<{}, [string, Option.Option<string>]>({
        name: "app",
        arguments: [
          Commander.argument("input", Schema.String),
          Commander.argument("output", Schema.String, { optional: true })
        ]
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["input.txt"])
      )

      t.expect(result.arguments[0]).toBe("input.txt")
      t.expect(Option.isNone(result.arguments[1])).toBe(true)
    })

    t.it("should handle default values", async () => {
      const cmd = Commander.command<{ count: number }, []>({
        name: "app",
        options: {
          count: Commander.option("count", Commander.NumberFromString, {
            defaultValue: 10
          })
        }
      })

      const result = await Effect.runPromise(Commander.parse(cmd, []))

      t.expect(result.options.count).toBe(10)
    })

    t.it("should override default values", async () => {
      const cmd = Commander.command<{ count: number }, []>({
        name: "app",
        options: {
          count: Commander.option("count", Commander.NumberFromString, {
            defaultValue: 10
          })
        }
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--count", "20"])
      )

      t.expect(result.options.count).toBe(20)
    })

    t.it("should fail on invalid number", async () => {
      const cmd = Commander.command<{ count: number }, []>({
        name: "app",
        options: {
          count: Commander.option("count", Commander.NumberFromString)
        }
      })

      const result = await Effect.runPromise(
        Effect.either(Commander.parse(cmd, ["--count", "abc"]))
      )

      t.expect(result._tag).toBe("Left")
    })

    t.it("should handle double dash separator", async () => {
      const cmd = Commander.command<{ verbose: boolean }, [string]>({
        name: "app",
        options: {
          verbose: Commander.flag("verbose")
        },
        arguments: [Commander.argument("file", Schema.String)]
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--", "--verbose"])
      )

      t.expect(result.options.verbose).toBe(false)
      t.expect(result.arguments[0]).toBe("--verbose")
    })

    t.it("should fail on help flag", async () => {
      const cmd = Commander.command<{}, []>({
        name: "app"
      })

      const result = await Effect.runPromise(
        Effect.either(Commander.parse(cmd, ["--help"]))
      )

      t.expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        t.expect(result.left.message).toBe("Help requested")
      }
    })

    t.it("should fail on version flag", async () => {
      const cmd = Commander.command<{}, []>({
        name: "app",
        version: "1.0.0"
      })

      const result = await Effect.runPromise(
        Effect.either(Commander.parse(cmd, ["-V"]))
      )

      t.expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        t.expect(result.left.message).toBe("Version requested")
      }
    })
  })

  t.describe("help", () => {
    t.it("should generate help text", () => {
      const cmd = Commander.command<
        { verbose: boolean; output: string },
        [string]
      >({
        name: "myapp",
        description: "My awesome application",
        version: "1.0.0",
        options: {
          verbose: Commander.flag("verbose", {
            short: "v",
            description: "Enable verbose output"
          }),
          output: Commander.option("output", Schema.String, {
            short: "o",
            description: "Output file"
          })
        },
        arguments: [
          Commander.argument("input", Schema.String, {
            description: "Input file"
          })
        ]
      })

      const helpText = Commander.help(cmd)

      t.expect(helpText).toContain("My awesome application")
      t.expect(helpText).toContain("Usage: myapp [options] <input>")
      t.expect(helpText).toContain("--verbose")
      t.expect(helpText).toContain("-v,")
      t.expect(helpText).toContain("--output")
      t.expect(helpText).toContain("-o,")
      t.expect(helpText).toContain("--help")
      t.expect(helpText).toContain("--version")
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
    t.it("should accept valid choices", async () => {
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

  t.describe("integration tests", () => {
    t.it("should parse complex command", async () => {
      const cmd = Commander.command<
        {
          verbose: boolean
          output: string
          count: number
          format: "json" | "xml" | "yaml"
        },
        [string, Option.Option<string>]
      >({
        name: "converter",
        description: "Convert files between formats",
        version: "2.1.0",
        options: {
          verbose: Commander.flag("verbose", { short: "v" }),
          output: Commander.option("output", Schema.String, {
            short: "o",
            defaultValue: "output.txt"
          }),
          count: Commander.option("count", Commander.NumberFromString, {
            short: "c",
            defaultValue: 1
          }),
          format: Commander.option(
            "format",
            Commander.choice(["json", "xml", "yaml"]),
            {
              short: "f",
              defaultValue: "json"
            }
          )
        },
        arguments: [
          Commander.argument("input", Schema.String),
          Commander.argument("dest", Schema.String, { optional: true })
        ]
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, [
          "-v",
          "--output",
          "result.txt",
          "-c",
          "5",
          "--format=yaml",
          "input.txt"
        ])
      )

      t.expect(result.options.verbose).toBe(true)
      t.expect(result.options.output).toBe("result.txt")
      t.expect(result.options.count).toBe(5)
      t.expect(result.options.format).toBe("yaml")
      t.expect(result.arguments[0]).toBe("input.txt")
      t.expect(Option.isNone(result.arguments[1])).toBe(true)
    })
  })
})
