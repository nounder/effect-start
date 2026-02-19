import * as test from "bun:test"
import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"

import * as ChildProcess from "effect-start/ChildProcess"
import * as PlatformError from "effect-start/PlatformError"
import { BunChildProcessSpawner } from "effect-start/bun"

const run = <A, E>(effect: Effect.Effect<A, E, ChildProcess.ChildProcessSpawner | Scope.Scope>) =>
  Effect.provide(effect, BunChildProcessSpawner.layer).pipe(Effect.scoped, Effect.runPromise)

test.describe("ChildProcess.make", () => {
  test.it("creates a command", () => {
    const cmd = ChildProcess.make(["echo", "hello"])

    test.expect(cmd.cmd).toEqual(["echo", "hello"])
  })

  test.it("creates with options", () => {
    const cmd = ChildProcess.make(["echo", "hello"], { cwd: "/tmp" })

    test.expect(cmd.cwd).toBe("/tmp")
  })

  test.it("isCommand", () => {
    const cmd = ChildProcess.make(["echo"])

    test.expect(ChildProcess.isCommand(cmd)).toBe(true)
    test.expect(ChildProcess.isCommand({})).toBe(false)
  })

  test.it("is pipeable", () => {
    const cmd = ChildProcess.make(["echo", "hello"])
    const result = cmd.pipe((c) => c.cmd)

    test.expect(result).toEqual(["echo", "hello"])
  })
})

test.describe("spawn + stdout", () => {
  test.it("reads stdout", async () => {
    const result = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(ChildProcess.make(["echo", "hello"]))
        return yield* handle.stdout.pipe(Stream.decodeText("utf-8"), Stream.mkString)
      }),
    )

    test.expect(result).toBe("hello\n")
  })

  test.it("command is yieldable", async () => {
    const result = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.make(["echo", "hello"])
        return yield* handle.stdout.pipe(Stream.decodeText("utf-8"), Stream.mkString)
      }),
    )

    test.expect(result).toBe("hello\n")
  })

  test.it("streams multi-line output", async () => {
    const result = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(
          ChildProcess.make(["printf", "line1\nline2\nline3"]),
        )
        return yield* handle.stdout.pipe(
          Stream.decodeText("utf-8"),
          Stream.splitLines,
          Stream.runCollect,
        )
      }),
    )

    test.expect(Array.from(result)).toEqual(["line1", "line2", "line3"])
  })
})

test.describe("spawn + exitCode", () => {
  test.it("returns 0 for success", async () => {
    const code = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(ChildProcess.make(["true"]))
        return yield* handle.exitCode
      }),
    )

    test.expect(code).toBe(0)
  })

  test.it("returns non-zero exit code", async () => {
    const code = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(ChildProcess.make(["false"]))
        return yield* handle.exitCode
      }),
    )

    test.expect(code).toBe(1)
  })
})

test.describe("spawn + pid", () => {
  test.it("provides pid", async () => {
    const pid = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(ChildProcess.make(["echo", "hello"]))
        return handle.pid
      }),
    )

    test.expect(pid).toBeGreaterThan(0)
  })
})

test.describe("spawn + isRunning", () => {
  test.it("reports running state", async () => {
    const result = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(ChildProcess.make(["sleep", "10"]))
        const running = yield* handle.isRunning
        yield* handle.kill()
        return running
      }),
    )

    test.expect(result).toBe(true)
  })
})

test.describe("spawn + kill", () => {
  test.it("kills a running process", async () => {
    const result = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(ChildProcess.make(["sleep", "10"]))
        yield* handle.kill()
        yield* Effect.sleep("50 millis")
        return yield* handle.isRunning
      }),
    )

    test.expect(result).toBe(false)
  })
})

test.describe("spawn + stderr", () => {
  test.it("reads stderr", async () => {
    const result = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(ChildProcess.make(["sh", "-c", "echo error >&2"]))
        return yield* handle.stderr.pipe(Stream.decodeText("utf-8"), Stream.mkString)
      }),
    )

    test.expect(result).toBe("error\n")
  })
})

test.describe("spawn + stdin", () => {
  test.it("writes to stdin via sink", async () => {
    const result = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(ChildProcess.make(["cat"], { stdin: "pipe" }))
        const input = new TextEncoder().encode("hello from stdin")
        yield* Stream.make(input).pipe(Stream.run(handle.stdin))
        return yield* handle.stdout.pipe(Stream.decodeText("utf-8"), Stream.mkString)
      }),
    )

    test.expect(result).toBe("hello from stdin")
  })
})

test.describe("spawn + options", () => {
  test.it("applies cwd", async () => {
    const result = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(ChildProcess.make(["pwd"], { cwd: "/tmp" }))
        return yield* handle.stdout.pipe(Stream.decodeText("utf-8"), Stream.mkString)
      }),
    )

    test.expect(result.trim()).toMatch(/\/tmp/)
  })

  test.it("applies env", async () => {
    const result = await run(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.spawn(
          ChildProcess.make(["printenv", "MY_TEST_VAR"], { env: { MY_TEST_VAR: "hello123" } }),
        )
        return yield* handle.stdout.pipe(Stream.decodeText("utf-8"), Stream.mkString)
      }),
    )

    test.expect(result.trim()).toBe("hello123")
  })
})

test.describe("spawn errors", () => {
  test.it("fails for non-existent command", () =>
    Effect.gen(function* () {
      const error = yield* ChildProcess.spawn(
        ChildProcess.make(["__nonexistent_command_xyz__"]),
      ).pipe(Effect.flip)

      test.expect(PlatformError.isPlatformError(error)).toBe(true)
      test.expect((error as PlatformError.SystemError).module).toBe("ChildProcess")
      test.expect((error as PlatformError.SystemError).method).toBe("spawn")
    }).pipe(Effect.provide(BunChildProcessSpawner.layer), Effect.scoped, Effect.runPromise),
  )
})
