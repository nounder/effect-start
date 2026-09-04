import * as test from "bun:test"
import { BunChildProcessSpawner, BunFileSystem, BunPath } from "effect-start/bun"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as Sink from "effect/Sink"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner"

const layer = BunChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.merge(BunFileSystem.layer, BunPath.layer)),
)

const run = <A, E>(
  effect: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner | Scope.Scope>,
) =>
  effect.pipe(
    Effect.provide(layer),
    Effect.scoped,
    Effect.runPromise,
  )

const text = (stream: Stream.Stream<Uint8Array, unknown>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.mkString,
  )

test.describe("BunChildProcessSpawner export", () => {
  test.it("provides the canonical spawner service", () =>
    Effect
      .gen(function*() {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

        test
          .expect(typeof spawner.spawn)
          .toBe("function")
      })
      .pipe(
        Effect.provide(layer),
        Effect.scoped,
        Effect.runPromise,
      ))

  test.it("runs standard and piped commands", async () => {
    const output = await run(
      Effect.gen(function*() {
        const command = ChildProcess.make("printf", ["hello"]).pipe(
          ChildProcess.pipeTo(ChildProcess.make("tr", ["a-z", "A-Z"])),
        )
        const handle = yield* command

        test
          .expect(handle.pid)
          .toBeGreaterThan(0)
        test
          .expect(yield* handle.exitCode)
          .toBe(ChildProcessSpawner.ExitCode(0))

        return yield* text(handle.stdout)
      }),
    )

    test
      .expect(output)
      .toBe("HELLO")
  })

  test.it("supports stdin sinks and configured stdout sinks", async () => {
    const chunks: Array<Uint8Array> = []
    await run(
      Effect.gen(function*() {
        const handle = yield* ChildProcess.make("cat", [], {
          stdin: "pipe",
          stdout: Sink.forEach((chunk: Uint8Array) => Effect.sync(() => chunks.push(chunk))).pipe(
            Sink.map(() => new Uint8Array()),
          ),
        })
        yield* Stream.make(new TextEncoder().encode("from stdin")).pipe(Stream.run(handle.stdin))
        yield* Stream.runDrain(handle.stdout)
        yield* handle.exitCode
      }),
    )

    test
      .expect(new TextDecoder().decode(Buffer.concat(chunks)))
      .toBe("from stdin")
  })

  test.it("exposes stderr, all, and additional descriptors", async () => {
    const result = await run(
      Effect.gen(function*() {
        const handle = yield* ChildProcess.make("sh", ["-c", "printf out; printf err >&2; printf fd3 >&3"], {
          additionalFds: { fd3: { type: "output" } },
        })
        const [all, fd3] = yield* Effect.all([
          text(handle.all),
          text(handle.getOutputFd(3)),
        ], { concurrency: "unbounded" })
        yield* handle.exitCode
        const stderrHandle = yield* ChildProcess.make("sh", ["-c", "printf err >&2"])
        const stderr = yield* text(stderrHandle.stderr)
        yield* stderrHandle.exitCode
        return { all, fd3, stderr }
      }),
    )

    test
      .expect(result.stderr)
      .toContain("err")
    test
      .expect(result.all)
      .toContain("out")
    test
      .expect(result.all)
      .toContain("err")
    test
      .expect(result.fd3)
      .toBe("fd3")
  })

  test.it("kills a detached process and supports unref/reref", async () => {
    const running = await run(
      Effect.gen(function*() {
        const handle = yield* ChildProcess.make("sleep", ["10"], { detached: true, stdin: "ignore" })

        test
          .expect(yield* handle.isRunning)
          .toBe(true)

        const reref = yield* handle.unref
        yield* reref
        yield* handle.kill({ killSignal: "SIGKILL" })
        const exit = yield* Effect.exit(handle.exitCode)
        return { exit, running: yield* handle.isRunning }
      }),
    )

    test
      .expect(Exit.isFailure(running.exit))
      .toBe(true)
    test
      .expect(running.running)
      .toBe(false)
  })
})
