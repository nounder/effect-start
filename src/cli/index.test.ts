import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Cli from "./index.ts"

const parse = (cmd: Cli.Command<any, any, any, any>, args: ReadonlyArray<string>) =>
  Cli.runWith(cmd, { version: "1.0.0" })(args) as Effect.Effect<void, any>

test.describe("Argument", () => {
  test.it("string", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { name: Cli.Argument.string("name") }, (cfg) =>
        Effect.sync(() => { result = cfg.name }))
      yield* parse(cmd, ["hello"])
      test.expect(result).toBe("hello")
    }).pipe(Effect.runPromise))

  test.it("integer", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { count: Cli.Argument.integer("count") }, (cfg) =>
        Effect.sync(() => { result = cfg.count }))
      yield* parse(cmd, ["42"])
      test.expect(result).toBe(42)
    }).pipe(Effect.runPromise))

  test.it("float", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { value: Cli.Argument.float("value") }, (cfg) =>
        Effect.sync(() => { result = cfg.value }))
      yield* parse(cmd, ["3.14"])
      test.expect(result).toBe(3.14)
    }).pipe(Effect.runPromise))

  test.it("date", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { d: Cli.Argument.date("d") }, (cfg) =>
        Effect.sync(() => { result = cfg.d }))
      yield* parse(cmd, ["2024-01-01"])
      test.expect(result).toBeInstanceOf(Date)
    }).pipe(Effect.runPromise))

  test.it("choice", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { env: Cli.Argument.choice("env", ["dev", "prod"]) }, (cfg) =>
        Effect.sync(() => { result = cfg.env }))
      yield* parse(cmd, ["prod"])
      test.expect(result).toBe("prod")
    }).pipe(Effect.runPromise))

  test.it("optional returns None when missing", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { name: Cli.Argument.optional(Cli.Argument.string("name")) }, (cfg) =>
        Effect.sync(() => { result = cfg.name }))
      yield* parse(cmd, [])
      test.expect(Option.isNone(result as Option.Option<string>)).toBe(true)
    }).pipe(Effect.runPromise))

  test.it("optional returns Some when present", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { name: Cli.Argument.optional(Cli.Argument.string("name")) }, (cfg) =>
        Effect.sync(() => { result = cfg.name }))
      yield* parse(cmd, ["hello"])
      test.expect(Option.getOrNull(result as Option.Option<string>)).toBe("hello")
    }).pipe(Effect.runPromise))

  test.it("withDefault", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        name: Cli.Argument.string("name").pipe(Cli.Argument.withDefault("world")),
      }, (cfg) => Effect.sync(() => { result = cfg.name }))
      yield* parse(cmd, [])
      test.expect(result).toBe("world")
    }).pipe(Effect.runPromise))

  test.it("variadic", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        files: Cli.Argument.string("file").pipe(Cli.Argument.variadic()),
      }, (cfg) => Effect.sync(() => { result = cfg.files }))
      yield* parse(cmd, ["a.txt", "b.txt", "c.txt"])
      test.expect(result).toEqual(["a.txt", "b.txt", "c.txt"])
    }).pipe(Effect.runPromise))

  test.it("map", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        name: Cli.Argument.string("name").pipe(Cli.Argument.map((s) => s.toUpperCase())),
      }, (cfg) => Effect.sync(() => { result = cfg.name }))
      yield* parse(cmd, ["hello"])
      test.expect(result).toBe("HELLO")
    }).pipe(Effect.runPromise))

  test.it("multiple arguments in order", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        first: Cli.Argument.string("first"),
        second: Cli.Argument.integer("second"),
      }, (cfg) => Effect.sync(() => { result = cfg }))
      yield* parse(cmd, ["hello", "42"])
      test.expect(result).toEqual({ first: "hello", second: 42 })
    }).pipe(Effect.runPromise))
})

test.describe("Flag", () => {
  test.it("string", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { output: Cli.Flag.string("output") }, (cfg) =>
        Effect.sync(() => { result = cfg.output }))
      yield* parse(cmd, ["--output", "file.txt"])
      test.expect(result).toBe("file.txt")
    }).pipe(Effect.runPromise))

  test.it("boolean defaults to false when absent", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { verbose: Cli.Flag.boolean("verbose") }, (cfg) =>
        Effect.sync(() => { result = cfg.verbose }))
      yield* parse(cmd, [])
      test.expect(result).toBe(false)
    }).pipe(Effect.runPromise))

  test.it("boolean true when present", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { verbose: Cli.Flag.boolean("verbose") }, (cfg) =>
        Effect.sync(() => { result = cfg.verbose }))
      yield* parse(cmd, ["--verbose"])
      test.expect(result).toBe(true)
    }).pipe(Effect.runPromise))

  test.it("boolean explicit value", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { verbose: Cli.Flag.boolean("verbose") }, (cfg) =>
        Effect.sync(() => { result = cfg.verbose }))
      yield* parse(cmd, ["--verbose", "false"])
      test.expect(result).toBe(false)
    }).pipe(Effect.runPromise))

  test.it("integer", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { count: Cli.Flag.integer("count") }, (cfg) =>
        Effect.sync(() => { result = cfg.count }))
      yield* parse(cmd, ["--count", "5"])
      test.expect(result).toBe(5)
    }).pipe(Effect.runPromise))

  test.it("choice", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { level: Cli.Flag.choice("level", ["low", "high"]) }, (cfg) =>
        Effect.sync(() => { result = cfg.level }))
      yield* parse(cmd, ["--level", "high"])
      test.expect(result).toBe("high")
    }).pipe(Effect.runPromise))

  test.it("withAlias short flag", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        verbose: Cli.Flag.boolean("verbose").pipe(Cli.Flag.withAlias("v")),
      }, (cfg) => Effect.sync(() => { result = cfg.verbose }))
      yield* parse(cmd, ["-v"])
      test.expect(result).toBe(true)
    }).pipe(Effect.runPromise))

  test.it("optional flag", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        output: Cli.Flag.optional(Cli.Flag.string("output")),
      }, (cfg) => Effect.sync(() => { result = cfg.output }))
      yield* parse(cmd, [])
      test.expect(Option.isNone(result as Option.Option<string>)).toBe(true)
    }).pipe(Effect.runPromise))

  test.it("withDefault flag", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        output: Cli.Flag.string("output").pipe(Cli.Flag.withDefault("out.txt")),
      }, (cfg) => Effect.sync(() => { result = cfg.output }))
      yield* parse(cmd, [])
      test.expect(result).toBe("out.txt")
    }).pipe(Effect.runPromise))

  test.it("variadic flag", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        tags: Cli.Flag.string("tag").pipe(Cli.Flag.variadic()),
      }, (cfg) => Effect.sync(() => { result = cfg.tags }))
      yield* parse(cmd, ["--tag", "a", "--tag", "b"])
      test.expect(result).toEqual(["a", "b"])
    }).pipe(Effect.runPromise))

  test.it("flags and arguments mixed", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        name: Cli.Argument.string("name"),
        verbose: Cli.Flag.boolean("verbose"),
      }, (cfg) => Effect.sync(() => { result = cfg }))
      yield* parse(cmd, ["--verbose", "hello"])
      test.expect(result).toEqual({ name: "hello", verbose: true })
    }).pipe(Effect.runPromise))
})

test.describe("Lexer", () => {
  test.it("long option with =", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", { output: Cli.Flag.string("output") }, (cfg) =>
        Effect.sync(() => { result = cfg.output }))
      yield* parse(cmd, ["--output=file.txt"])
      test.expect(result).toBe("file.txt")
    }).pipe(Effect.runPromise))

  test.it("short flag bundling", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        a: Cli.Flag.boolean("a"),
        b: Cli.Flag.boolean("b"),
        c: Cli.Flag.boolean("c"),
      }, (cfg) => Effect.sync(() => { result = cfg }))
      yield* parse(cmd, ["-abc"])
      test.expect(result).toEqual({ a: true, b: true, c: true })
    }).pipe(Effect.runPromise))

  test.it("-- separator sends rest as arguments", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        files: Cli.Argument.string("file").pipe(Cli.Argument.variadic()),
      }, (cfg) => Effect.sync(() => { result = cfg.files }))
      yield* parse(cmd, ["--", "--not-a-flag", "file.txt"])
      test.expect(result).toEqual(["--not-a-flag", "file.txt"])
    }).pipe(Effect.runPromise))
})

test.describe("Command", () => {
  test.it("make with no config", () => {
    const cmd = Cli.make("test")
    test.expect(cmd.name).toBe("test")
  })

  test.it("withDescription", () => {
    const cmd = Cli.make("test").pipe(Cli.withDescription("A test command"))
    test.expect(cmd.description).toBe("A test command")
  })

  test.it("withHandler", () =>
    Effect.gen(function*() {
      let called = false
      const cmd = Cli.make("test", { name: Cli.Argument.string("name") }).pipe(
        Cli.withHandler(() => Effect.sync(() => { called = true })),
      )
      yield* parse(cmd, ["hello"])
      test.expect(called).toBe(true)
    }).pipe(Effect.runPromise))

  test.it("subcommands route to correct handler", () =>
    Effect.gen(function*() {
      let result: unknown

      const add = Cli.make("add", { file: Cli.Argument.string("file") }, (cfg) =>
        Effect.sync(() => { result = { action: "add", file: cfg.file } }))

      const remove = Cli.make("remove", { file: Cli.Argument.string("file") }, (cfg) =>
        Effect.sync(() => { result = { action: "remove", file: cfg.file } }))

      const cmd = Cli.make("git").pipe(Cli.withSubcommands([add, remove]))
      yield* parse(cmd, ["add", "hello.txt"])
      test.expect(result).toEqual({ action: "add", file: "hello.txt" })
    }).pipe(Effect.runPromise))

  test.it("subcommands with parent flags", () =>
    Effect.gen(function*() {
      let result: unknown

      const sub = Cli.make("sub", {}, () =>
        Effect.sync(() => { result = "sub called" }))

      const cmd = Cli.make("app", { verbose: Cli.Flag.boolean("verbose") }).pipe(
        Cli.withSubcommands([sub]),
      )
      yield* parse(cmd, ["sub", "--verbose"])
      test.expect(result).toBe("sub called")
    }).pipe(Effect.runPromise))

  test.it("nested config objects", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        db: {
          host: Cli.Flag.string("host"),
          port: Cli.Flag.integer("port"),
        },
      }, (cfg) => Effect.sync(() => { result = cfg }))
      yield* parse(cmd, ["--host", "localhost", "--port", "5432"])
      test.expect(result).toEqual({ db: { host: "localhost", port: 5432 } })
    }).pipe(Effect.runPromise))

  test.it("config with arrays", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        pair: [Cli.Argument.string("key"), Cli.Argument.string("value")],
      }, (cfg) => Effect.sync(() => { result = cfg }))
      yield* parse(cmd, ["name", "alice"])
      test.expect(result).toEqual({ pair: ["name", "alice"] })
    }).pipe(Effect.runPromise))
})

test.describe("Errors", () => {
  test.it("missing required argument shows help (does not throw)", () =>
    Effect.gen(function*() {
      let handlerCalled = false
      const cmd = Cli.make("test", { name: Cli.Argument.string("name") }, () =>
        Effect.sync(() => { handlerCalled = true }))
      yield* parse(cmd, [])
      test.expect(handlerCalled).toBe(false)
    }).pipe(Effect.runPromise))

  test.it("missing required flag shows help (does not throw)", () =>
    Effect.gen(function*() {
      let handlerCalled = false
      const cmd = Cli.make("test", { output: Cli.Flag.string("output") }, () =>
        Effect.sync(() => { handlerCalled = true }))
      yield* parse(cmd, [])
      test.expect(handlerCalled).toBe(false)
    }).pipe(Effect.runPromise))

  test.it("invalid integer value shows help (does not throw)", () =>
    Effect.gen(function*() {
      let handlerCalled = false
      const cmd = Cli.make("test", { count: Cli.Argument.integer("count") }, () =>
        Effect.sync(() => { handlerCalled = true }))
      yield* parse(cmd, ["abc"])
      test.expect(handlerCalled).toBe(false)
    }).pipe(Effect.runPromise))

  test.it("isCliError", () => {
    const err = new Cli.MissingOption({ option: "test" })
    test.expect(Cli.isCliError(err)).toBe(true)
    test.expect(Cli.isCliError(new Error("not cli"))).toBe(false)
  })

  test.it("error messages", () => {
    test.expect(new Cli.MissingOption({ option: "output" }).message).toBe("Missing required flag: --output")
    test.expect(new Cli.MissingArgument({ argument: "name" }).message).toBe("Missing required argument: name")
    test.expect(new Cli.InvalidValue({ option: "count", value: "abc", expected: "integer", kind: "flag" }).message)
      .toBe('Invalid value for flag --count: "abc". Expected: integer')
  })

  test.it("unrecognized option with suggestions", () => {
    const err = new Cli.UnrecognizedOption({
      option: "--verbos",
      suggestions: ["--verbose"],
    })
    test.expect(err.message).toContain("Unrecognized flag")
    test.expect(err.message).toContain("Did you mean")
    test.expect(err.message).toContain("--verbose")
  })
})

test.describe("Types", () => {
  test.it("infers config types correctly", () => {
    const cmd = Cli.make("test", {
      name: Cli.Argument.string("name"),
      count: Cli.Flag.integer("count"),
      verbose: Cli.Flag.boolean("verbose"),
    }, (cfg) => {
      test.expectTypeOf(cfg).toEqualTypeOf<{
        readonly name: string
        readonly count: number
        readonly verbose: boolean
      }>()
      return Effect.void
    })
    test.expect(cmd.name).toBe("test")
  })

  test.it("infers optional types", () => {
    Cli.make("test", {
      name: Cli.Argument.optional(Cli.Argument.string("name")),
    }, (cfg) => {
      test.expectTypeOf(cfg.name).toEqualTypeOf<Option.Option<string>>()
      return Effect.void
    })
  })

  test.it("infers nested config types", () => {
    Cli.make("test", {
      db: {
        host: Cli.Flag.string("host"),
        port: Cli.Flag.integer("port"),
      },
    }, (cfg) => {
      test.expectTypeOf(cfg.db).toEqualTypeOf<{
        readonly host: string
        readonly port: number
      }>()
      return Effect.void
    })
  })

  test.it("variadic returns array at runtime", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        files: Cli.Argument.string("file").pipe(Cli.Argument.variadic()),
      }, (cfg) => Effect.sync(() => { result = cfg.files }))
      yield* parse(cmd, ["a", "b"])
      test.expect(result).toEqual(["a", "b"])
    }).pipe(Effect.runPromise))

  test.it("withDefault returns value at runtime", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Cli.make("test", {
        name: Cli.Argument.string("name").pipe(Cli.Argument.withDefault("world")),
      }, (cfg) => Effect.sync(() => { result = cfg.name }))
      yield* parse(cmd, [])
      test.expect(result).toBe("world")
    }).pipe(Effect.runPromise))
})
