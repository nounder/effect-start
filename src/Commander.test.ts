import * as t from "bun:test"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Commander from "./Commander"

t.describe("Commander", () => {
  t.describe("boolean options", () => {
    t.it("parses short flag", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          verbose: Commander.boolean({ short: "v" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["-v"]),
      )

      t.expect(result.options.verbose).toBe(true)
    })

    t.it("parses long flag", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          verbose: Commander.boolean({ long: "verbose" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--verbose"]),
      )

      t.expect(result.options.verbose).toBe(true)
    })

    t.it("defaults to false when not provided", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          verbose: Commander.boolean({ short: "v" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, []),
      )

      t.expect(result.options.verbose).toBeUndefined()
    })

    t.it("uses default value when specified", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          verbose: Commander.boolean({ short: "v", defaultValue: true }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, []),
      )

      t.expect(result.options.verbose).toBe(true)
    })
  })

  t.describe("string options", () => {
    t.it("parses short option with value", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          output: Commander.string({ short: "o" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["-o", "file.txt"]),
      )

      t.expect(result.options.output).toBe("file.txt")
    })

    t.it("parses long option with equals", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          output: Commander.string({ long: "output" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--output=file.txt"]),
      )

      t.expect(result.options.output).toBe("file.txt")
    })

    t.it("parses long option with space", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          output: Commander.string({ long: "output" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--output", "file.txt"]),
      )

      t.expect(result.options.output).toBe("file.txt")
    })

    t.it("fails when required option is missing", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          output: Commander.string({ short: "o", required: true }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Effect.exit(Commander.parse(cmd, [])),
      )

      t.expect(result._tag).toBe("Failure")
      if (result._tag === "Failure") {
        const error = Cause.failureOption(result.cause)
        t.expect(error._tag).toBe("Some")
        if (error._tag === "Some") {
          t.expect(error.value._tag).toBe("ValidationError")
        }
      }
    })

    t.it("uses default value when not provided", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          output: Commander.string({ short: "o", defaultValue: "out.txt" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, []),
      )

      t.expect(result.options.output).toBe("out.txt")
    })
  })

  t.describe("number options", () => {
    t.it("parses number from string", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          count: Commander.number({ short: "n" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["-n", "42"]),
      )

      t.expect(result.options.count).toBe(42)
    })

    t.it("fails on invalid number", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          count: Commander.number({ short: "n" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Effect.exit(Commander.parse(cmd, ["-n", "invalid"])),
      )

      t.expect(result._tag).toBe("Failure")
      if (result._tag === "Failure") {
        const error = Cause.failureOption(result.cause)
        t.expect(error._tag).toBe("Some")
        if (error._tag === "Some") {
          t.expect(error.value._tag).toBe("ValidationError")
        }
      }
    })

    t.it("uses default value", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          count: Commander.number({ short: "n", defaultValue: 10 }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, []),
      )

      t.expect(result.options.count).toBe(10)
    })
  })

  t.describe("custom schema options", () => {
    t.it("parses using custom schema", async () => {
      const PortSchema = Schema.NumberFromString.pipe(
        Schema.int(),
        Schema.greaterThanOrEqualTo(1),
        Schema.lessThanOrEqualTo(65535),
      )

      const cmd = Commander.command({
        name: "test",
        options: {
          port: Commander.option(PortSchema, { long: "port" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--port", "8080"]),
      )

      t.expect(result.options.port).toBe(8080)
    })

    t.it("validates using custom schema", async () => {
      const PortSchema = Schema.NumberFromString.pipe(
        Schema.int(),
        Schema.greaterThanOrEqualTo(1),
        Schema.lessThanOrEqualTo(65535),
      )

      const cmd = Commander.command({
        name: "test",
        options: {
          port: Commander.option(PortSchema, { long: "port" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Effect.exit(Commander.parse(cmd, ["--port", "99999"])),
      )

      t.expect(result._tag).toBe("Failure")
      if (result._tag === "Failure") {
        const error = Cause.failureOption(result.cause)
        t.expect(error._tag).toBe("Some")
        if (error._tag === "Some") {
          t.expect(error.value._tag).toBe("ValidationError")
        }
      }
    })

    t.it("parses enum using Literal schema", async () => {
      const LogLevelSchema = Schema.Literal("debug", "info", "warn", "error")

      const cmd = Commander.command({
        name: "test",
        options: {
          logLevel: Commander.option(LogLevelSchema, { long: "log-level" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--log-level", "debug"]),
      )

      t.expect(result.options.logLevel).toBe("debug")
    })

    t.it("validates enum using Literal schema", async () => {
      const LogLevelSchema = Schema.Literal("debug", "info", "warn", "error")

      const cmd = Commander.command({
        name: "test",
        options: {
          logLevel: Commander.option(LogLevelSchema, { long: "log-level" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Effect.exit(Commander.parse(cmd, ["--log-level", "invalid"])),
      )

      t.expect(result._tag).toBe("Failure")
      if (result._tag === "Failure") {
        const error = Cause.failureOption(result.cause)
        t.expect(error._tag).toBe("Some")
        if (error._tag === "Some") {
          t.expect(error.value._tag).toBe("ValidationError")
        }
      }
    })
  })

  t.describe("positional arguments", () => {
    t.it("parses required argument", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {},
        args: [
          Commander.argument(Schema.String, { name: "input" }),
        ],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["file.txt"]),
      )

      t.expect(result.args[0]).toBe("file.txt")
    })

    t.it("parses multiple arguments", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {},
        args: [
          Commander.argument(Schema.String, { name: "source" }),
          Commander.argument(Schema.String, { name: "dest" }),
        ],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["input.txt", "output.txt"]),
      )

      t.expect(result.args[0]).toBe("input.txt")
      t.expect(result.args[1]).toBe("output.txt")
    })

    t.it("fails when required argument is missing", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {},
        args: [
          Commander.argument(Schema.String, { name: "input", required: true }),
        ],
      })

      const result = await Effect.runPromise(
        Effect.exit(Commander.parse(cmd, [])),
      )

      t.expect(result._tag).toBe("Failure")
      if (result._tag === "Failure") {
        const error = Cause.failureOption(result.cause)
        t.expect(error._tag).toBe("Some")
        if (error._tag === "Some") {
          t.expect(error.value._tag).toBe("ValidationError")
        }
      }
    })

    t.it("uses default value for optional argument", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {},
        args: [
          Commander.argument(Schema.String, {
            name: "input",
            required: false,
            defaultValue: "default.txt",
          }),
        ],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, []),
      )

      t.expect(result.args[0]).toBe("default.txt")
    })

    t.it("validates argument types", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {},
        args: [
          Commander.argument(Schema.NumberFromString, { name: "count" }),
        ],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["42"]),
      )

      t.expect(result.args[0]).toBe(42)
    })
  })

  t.describe("combined options and arguments", () => {
    t.it("parses options and arguments together", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          verbose: Commander.boolean({ short: "v" }),
          output: Commander.string({ short: "o" }),
        },
        args: [
          Commander.argument(Schema.String, { name: "input" }),
        ],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["-v", "-o", "out.txt", "in.txt"]),
      )

      t.expect(result.options.verbose).toBe(true)
      t.expect(result.options.output).toBe("out.txt")
      t.expect(result.args[0]).toBe("in.txt")
    })

    t.it("handles -- separator for positional args", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          verbose: Commander.boolean({ short: "v" }),
        },
        args: [
          Commander.argument(Schema.String, { name: "file" }),
        ],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["--", "-v"]),
      )

      t.expect(result.options.verbose).toBeUndefined()
      t.expect(result.args[0]).toBe("-v")
    })
  })

  t.describe("combined short flags", () => {
    t.it("parses multiple boolean flags together", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          verbose: Commander.boolean({ short: "v" }),
          force: Commander.boolean({ short: "f" }),
          recursive: Commander.boolean({ short: "r" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["-vfr"]),
      )

      t.expect(result.options.verbose).toBe(true)
      t.expect(result.options.force).toBe(true)
      t.expect(result.options.recursive).toBe(true)
    })

    t.it("parses combined flags with value at end", async () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          verbose: Commander.boolean({ short: "v" }),
          output: Commander.string({ short: "o" }),
        },
        args: [],
      })

      const result = await Effect.runPromise(
        Commander.parse(cmd, ["-vo", "file.txt"]),
      )

      t.expect(result.options.verbose).toBe(true)
      t.expect(result.options.output).toBe("file.txt")
    })
  })

  t.describe("help text generation", () => {
    t.it("generates help text with description", () => {
      const cmd = Commander.command({
        name: "my-cli",
        description: "A sample CLI tool",
        options: {
          verbose: Commander.boolean({
            short: "v",
            long: "verbose",
            description: "Enable verbose output",
          }),
          output: Commander.string({
            short: "o",
            long: "output",
            description: "Output file",
            defaultValue: "out.txt",
          }),
        },
        args: [
          Commander.argument(Schema.String, {
            name: "input",
            description: "Input file",
          }),
        ],
      })

      const help = Commander.help(cmd)

      t.expect(help).toContain("A sample CLI tool")
      t.expect(help).toContain("my-cli")
      t.expect(help).toContain("--verbose")
      t.expect(help).toContain("Enable verbose output")
      t.expect(help).toContain("--output")
      t.expect(help).toContain("Output file")
      t.expect(help).toContain("default: out.txt")
      t.expect(help).toContain("input")
      t.expect(help).toContain("Input file")
    })

    t.it("marks required options", () => {
      const cmd = Commander.command({
        name: "test",
        options: {
          output: Commander.string({
            long: "output",
            required: true,
          }),
        },
        args: [],
      })

      const help = Commander.help(cmd)

      t.expect(help).toContain("[required]")
    })
  })
})
