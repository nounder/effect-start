import * as test from "bun:test"
import * as Effect from "effect/Effect"
import { Argument, Command, Flag } from "effect-start/cli"

const parse = (cmd: Command.Command<any, any, any, any>, args: ReadonlyArray<string>) =>
  Command.runWith(cmd, { version: "1.0.0" })(args) as Effect.Effect<void, any>

test.describe("Command", () => {
  test.it("make with no config", () => {
    const cmd = Command.make("test")
    test.expect(cmd.name).toBe("test")
  })

  test.it("description", () => {
    const cmd = Command.make("test", { description: "A test command" })
    test.expect(cmd.description).toBe("A test command")
  })

  test.it("handler", () =>
    Effect.gen(function* () {
      let called = false
      const cmd = Command.make("test", {
        config: { name: Argument.string("name") },
        handler: () =>
          Effect.sync(() => {
            called = true
          }),
      })
      yield* parse(cmd, ["hello"])
      test.expect(called).toBe(true)
    }).pipe(Effect.runPromise),
  )

  test.it("subcommands route to correct handler", () =>
    Effect.gen(function* () {
      let result: unknown

      const add = Command.make("add", {
        config: { file: Argument.string("file") },
        handler: (cfg) =>
          Effect.sync(() => {
            result = { action: "add", file: cfg.file }
          }),
      })

      const remove = Command.make("remove", {
        config: { file: Argument.string("file") },
        handler: (cfg) =>
          Effect.sync(() => {
            result = { action: "remove", file: cfg.file }
          }),
      })

      const cmd = Command.make("git", { subcommands: [add, remove] })
      yield* parse(cmd, ["add", "hello.txt"])
      test.expect(result).toEqual({ action: "add", file: "hello.txt" })
    }).pipe(Effect.runPromise),
  )

  test.it("subcommands with parent flags", () =>
    Effect.gen(function* () {
      let result: unknown

      const sub = Command.make("sub", {
        handler: () =>
          Effect.sync(() => {
            result = "sub called"
          }),
      })

      const cmd = Command.make("app", {
        config: { verbose: Flag.boolean("verbose") },
        subcommands: [sub],
      })
      yield* parse(cmd, ["sub", "--verbose"])
      test.expect(result).toBe("sub called")
    }).pipe(Effect.runPromise),
  )

  test.it("nested config objects", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: {
          db: {
            host: Flag.string("host"),
            port: Flag.integer("port"),
          },
        },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg
          }),
      })
      yield* parse(cmd, ["--host", "localhost", "--port", "5432"])
      test.expect(result).toEqual({ db: { host: "localhost", port: 5432 } })
    }).pipe(Effect.runPromise),
  )

  test.it("config with arrays", () =>
    Effect.gen(function* () {
      let result: unknown
      const cmd = Command.make("test", {
        config: { pair: [Argument.string("key"), Argument.string("value")] },
        handler: (cfg) =>
          Effect.sync(() => {
            result = cfg
          }),
      })
      yield* parse(cmd, ["name", "alice"])
      test.expect(result).toEqual({ pair: ["name", "alice"] })
    }).pipe(Effect.runPromise),
  )
})

test.describe("Command errors", () => {
  test.it("missing required argument shows help (does not throw)", () =>
    Effect.gen(function* () {
      let handlerCalled = false
      const cmd = Command.make("test", {
        config: { name: Argument.string("name") },
        handler: () =>
          Effect.sync(() => {
            handlerCalled = true
          }),
      })
      yield* parse(cmd, [])
      test.expect(handlerCalled).toBe(false)
    }).pipe(Effect.runPromise),
  )

  test.it("missing required flag shows help (does not throw)", () =>
    Effect.gen(function* () {
      let handlerCalled = false
      const cmd = Command.make("test", {
        config: { output: Flag.string("output") },
        handler: () =>
          Effect.sync(() => {
            handlerCalled = true
          }),
      })
      yield* parse(cmd, [])
      test.expect(handlerCalled).toBe(false)
    }).pipe(Effect.runPromise),
  )

  test.it("invalid integer value shows help (does not throw)", () =>
    Effect.gen(function* () {
      let handlerCalled = false
      const cmd = Command.make("test", {
        config: { count: Argument.integer("count") },
        handler: () =>
          Effect.sync(() => {
            handlerCalled = true
          }),
      })
      yield* parse(cmd, ["abc"])
      test.expect(handlerCalled).toBe(false)
    }).pipe(Effect.runPromise),
  )
})

test.describe("Command types", () => {
  test.it("infers config types correctly", () => {
    const cmd = Command.make("test", {
      config: {
        name: Argument.string("name"),
        count: Flag.integer("count"),
        verbose: Flag.boolean("verbose"),
      },
      handler: (cfg) => {
        test.expectTypeOf(cfg).toEqualTypeOf<{
          readonly name: string
          readonly count: number
          readonly verbose: boolean
        }>()
        return Effect.void
      },
    })
    test.expect(cmd.name).toBe("test")
  })

  test.it("infers nested config types", () => {
    Command.make("test", {
      config: {
        db: {
          host: Flag.string("host"),
          port: Flag.integer("port"),
        },
      },
      handler: (cfg) => {
        test.expectTypeOf(cfg.db).toEqualTypeOf<{
          readonly host: string
          readonly port: number
        }>()
        return Effect.void
      },
    })
  })
})
