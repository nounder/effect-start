import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Argument, Command } from "effect-start/cli"

const parse = (cmd: Command.Command<any, any, any, any>, args: ReadonlyArray<string>) =>
  Command.runWith(cmd, { version: "1.0.0" })(args) as Effect.Effect<void, any>

test.describe("Argument", () => {
  test.it("string", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { name: Argument.string("name") },
        handler: (cfg) => Effect.sync(() => { result = cfg.name }),
      })
      yield* parse(cmd, ["hello"])
      test.expect(result).toBe("hello")
    }).pipe(Effect.runPromise))

  test.it("integer", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { count: Argument.integer("count") },
        handler: (cfg) => Effect.sync(() => { result = cfg.count }),
      })
      yield* parse(cmd, ["42"])
      test.expect(result).toBe(42)
    }).pipe(Effect.runPromise))

  test.it("float", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { value: Argument.float("value") },
        handler: (cfg) => Effect.sync(() => { result = cfg.value }),
      })
      yield* parse(cmd, ["3.14"])
      test.expect(result).toBe(3.14)
    }).pipe(Effect.runPromise))

  test.it("date", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { d: Argument.date("d") },
        handler: (cfg) => Effect.sync(() => { result = cfg.d }),
      })
      yield* parse(cmd, ["2024-01-01"])
      test.expect(result).toBeInstanceOf(Date)
    }).pipe(Effect.runPromise))

  test.it("choice", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { env: Argument.choice("env", ["dev", "prod"]) },
        handler: (cfg) => Effect.sync(() => { result = cfg.env }),
      })
      yield* parse(cmd, ["prod"])
      test.expect(result).toBe("prod")
    }).pipe(Effect.runPromise))

  test.it("optional returns None when missing", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { name: Argument.optional(Argument.string("name")) },
        handler: (cfg) => Effect.sync(() => { result = cfg.name }),
      })
      yield* parse(cmd, [])
      test.expect(Option.isNone(result as Option.Option<string>)).toBe(true)
    }).pipe(Effect.runPromise))

  test.it("optional returns Some when present", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { name: Argument.optional(Argument.string("name")) },
        handler: (cfg) => Effect.sync(() => { result = cfg.name }),
      })
      yield* parse(cmd, ["hello"])
      test.expect(Option.getOrNull(result as Option.Option<string>)).toBe("hello")
    }).pipe(Effect.runPromise))

  test.it("withDefault", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { name: Argument.string("name").pipe(Argument.withDefault("world")) },
        handler: (cfg) => Effect.sync(() => { result = cfg.name }),
      })
      yield* parse(cmd, [])
      test.expect(result).toBe("world")
    }).pipe(Effect.runPromise))

  test.it("variadic", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { files: Argument.string("file").pipe(Argument.variadic()) },
        handler: (cfg) => Effect.sync(() => { result = cfg.files }),
      })
      yield* parse(cmd, ["a.txt", "b.txt", "c.txt"])
      test.expect(result).toEqual(["a.txt", "b.txt", "c.txt"])
    }).pipe(Effect.runPromise))

  test.it("map", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { name: Argument.string("name").pipe(Argument.map((s) => s.toUpperCase())) },
        handler: (cfg) => Effect.sync(() => { result = cfg.name }),
      })
      yield* parse(cmd, ["hello"])
      test.expect(result).toBe("HELLO")
    }).pipe(Effect.runPromise))

  test.it("multiple arguments in order", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: {
          first: Argument.string("first"),
          second: Argument.integer("second"),
        },
        handler: (cfg) => Effect.sync(() => { result = cfg }),
      })
      yield* parse(cmd, ["hello", "42"])
      test.expect(result).toEqual({ first: "hello", second: 42 })
    }).pipe(Effect.runPromise))
})

test.describe("Argument types", () => {
  test.it("infers optional types", () => {
    Command.make("test", {
      config: { name: Argument.optional(Argument.string("name")) },
      handler: (cfg) => {
        test.expectTypeOf(cfg.name).toEqualTypeOf<Option.Option<string>>()
        return Effect.void
      },
    })
  })

  test.it("variadic returns array at runtime", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { files: Argument.string("file").pipe(Argument.variadic()) },
        handler: (cfg) => Effect.sync(() => { result = cfg.files }),
      })
      yield* parse(cmd, ["a", "b"])
      test.expect(result).toEqual(["a", "b"])
    }).pipe(Effect.runPromise))

  test.it("withDefault returns value at runtime", () =>
    Effect.gen(function*() {
      let result: unknown
      const cmd = Command.make("test", {
        config: { name: Argument.string("name").pipe(Argument.withDefault("world")) },
        handler: (cfg) => Effect.sync(() => { result = cfg.name }),
      })
      yield* parse(cmd, [])
      test.expect(result).toBe("world")
    }).pipe(Effect.runPromise))
})
