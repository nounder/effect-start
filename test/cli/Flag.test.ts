import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Argument, Command, Flag } from "effect-start/cli"

const parse = (cmd: Command.Command<any, any, any, any>, args: ReadonlyArray<string>) =>
  Command.runWith(cmd, { version: "1.0.0" })(args) as Effect.Effect<void, any>

test.describe("Flag", () => {
  test.it("string", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { output: Flag.string("output") },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.output
          }),
      })
      yield* parse(cmd, ["--output", "file.txt"])
      test.expect(result).toBe("file.txt")
    }).pipe(Effect.runPromise),
  )

  test.it("boolean defaults to false when absent", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { verbose: Flag.boolean("verbose") },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.verbose
          }),
      })
      yield* parse(cmd, [])
      test.expect(result).toBe(false)
    }).pipe(Effect.runPromise),
  )

  test.it("boolean true when present", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { verbose: Flag.boolean("verbose") },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.verbose
          }),
      })
      yield* parse(cmd, ["--verbose"])
      test.expect(result).toBe(true)
    }).pipe(Effect.runPromise),
  )

  test.it("boolean explicit value", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { verbose: Flag.boolean("verbose") },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.verbose
          }),
      })
      yield* parse(cmd, ["--verbose", "false"])
      test.expect(result).toBe(false)
    }).pipe(Effect.runPromise),
  )

  test.it("integer", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { count: Flag.integer("count") },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.count
          }),
      })
      yield* parse(cmd, ["--count", "5"])
      test.expect(result).toBe(5)
    }).pipe(Effect.runPromise),
  )

  test.it("choice", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { level: Flag.choice("level", ["low", "high"]) },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.level
          }),
      })
      yield* parse(cmd, ["--level", "high"])
      test.expect(result).toBe("high")
    }).pipe(Effect.runPromise),
  )

  test.it("withAlias short flag", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { verbose: Flag.boolean("verbose").pipe(Flag.withAlias("v")) },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.verbose
          }),
      })
      yield* parse(cmd, ["-v"])
      test.expect(result).toBe(true)
    }).pipe(Effect.runPromise),
  )

  test.it("optional flag", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { output: Flag.optional(Flag.string("output")) },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.output
          }),
      })
      yield* parse(cmd, [])
      test.expect(Option.isNone(result as Option.Option<string>)).toBe(true)
    }).pipe(Effect.runPromise),
  )

  test.it("withDefault flag", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { output: Flag.string("output").pipe(Flag.withDefault("out.txt")) },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.output
          }),
      })
      yield* parse(cmd, [])
      test.expect(result).toBe("out.txt")
    }).pipe(Effect.runPromise),
  )

  test.it("variadic flag", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { tags: Flag.string("tag").pipe(Flag.variadic()) },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.tags
          }),
      })
      yield* parse(cmd, ["--tag", "a", "--tag", "b"])
      test.expect(result).toEqual(["a", "b"])
    }).pipe(Effect.runPromise),
  )

  test.it("flags and arguments mixed", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: {
          name: Argument.string("name"),
          verbose: Flag.boolean("verbose"),
        },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg
          }),
      })
      yield* parse(cmd, ["--verbose", "hello"])
      test.expect(result).toEqual({ name: "hello", verbose: true })
    }).pipe(Effect.runPromise),
  )
})

test.describe("Lexer", () => {
  test.it("long option with =", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { output: Flag.string("output") },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.output
          }),
      })
      yield* parse(cmd, ["--output=file.txt"])
      test.expect(result).toBe("file.txt")
    }).pipe(Effect.runPromise),
  )

  test.it("short flag bundling", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: {
          a: Flag.boolean("a"),
          b: Flag.boolean("b"),
          c: Flag.boolean("c"),
        },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg
          }),
      })
      yield* parse(cmd, ["-abc"])
      test.expect(result).toEqual({ a: true, b: true, c: true })
    }).pipe(Effect.runPromise),
  )

  test.it("-- separator sends rest as arguments", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { files: Argument.string("file").pipe(Argument.variadic()) },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg.files
          }),
      })
      yield* parse(cmd, ["--", "--not-a-flag", "file.txt"])
      test.expect(result).toEqual(["--not-a-flag", "file.txt"])
    }).pipe(Effect.runPromise),
  )
})
