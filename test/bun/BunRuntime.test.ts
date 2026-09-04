import * as test from "bun:test"

const bunRuntimeUrl = new URL("../../src/bun/BunRuntime.ts", import.meta.url).href

test.it("runs finalizers and exits with 130 on SIGTERM", async () => {
  const child = Bun.spawn([
    process.execPath,
    "-e",
    `
      import * as Effect from "effect/Effect"
      import * as BunRuntime from ${JSON.stringify(bunRuntimeUrl)}

      BunRuntime.runMain(
        Effect.acquireRelease(
          Effect.sync(() => console.log("ready")),
          () => Effect.sync(() => console.log("finalized")),
        ).pipe(
          Effect.andThen(Effect.never),
          Effect.scoped,
        ),
      )
    `,
  ], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const reader = child.stdout.getReader()
  const first = await reader.read()

  test
    .expect(new TextDecoder().decode(first.value))
    .toContain("ready")

  await Bun.sleep(50)
  child.kill("SIGTERM")
  const code = await child.exited
  let output = ""
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    output += new TextDecoder().decode(chunk.value)
  }

  test
    .expect(code)
    .toBe(130)
  test
    .expect(output)
    .toContain("finalized")
})

test.it("honors a custom teardown exit code after SIGTERM", async () => {
  const child = Bun.spawn([
    process.execPath,
    "-e",
    `
      import * as Effect from "effect/Effect"
      import * as BunRuntime from ${JSON.stringify(bunRuntimeUrl)}

      BunRuntime.runMain(
        Effect.sync(() => console.log("ready")).pipe(
          Effect.andThen(Effect.never),
        ),
        {
          teardown: (_exit, onExit) => onExit(42),
        },
      )
    `,
  ], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const reader = child.stdout.getReader()
  const first = await reader.read()

  test
    .expect(new TextDecoder().decode(first.value))
    .toContain("ready")

  await Bun.sleep(50)
  child.kill("SIGTERM")

  test
    .expect(await child.exited)
    .toBe(42)
})

test.it("keeps signal handlers installed until finalizers complete", async () => {
  const child = Bun.spawn([
    process.execPath,
    "-e",
    `
      import * as Effect from "effect/Effect"
      import * as BunRuntime from ${JSON.stringify(bunRuntimeUrl)}

      BunRuntime.runMain(
        Effect.acquireRelease(
          Effect.sync(() => console.log("ready")),
          () => Effect.sleep("100 millis").pipe(
            Effect.andThen(Effect.sync(() => console.log("finalized"))),
          ),
        ).pipe(
          Effect.andThen(Effect.never),
          Effect.scoped,
        ),
      )
    `,
  ], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const reader = child.stdout.getReader()
  const first = await reader.read()

  test
    .expect(new TextDecoder().decode(first.value))
    .toContain("ready")

  await Bun.sleep(50)
  child.kill("SIGTERM")
  await Bun.sleep(10)
  child.kill("SIGTERM")
  const code = await child.exited
  let output = ""
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    output += new TextDecoder().decode(chunk.value)
  }

  test
    .expect(code)
    .toBe(130)
  test
    .expect(output)
    .toContain("finalized")
})

test.it("exits with failure for an unhandled error", async () => {
  const child = Bun.spawn([
    process.execPath,
    "-e",
    `
      import * as Effect from "effect/Effect"
      import * as BunRuntime from ${JSON.stringify(bunRuntimeUrl)}

      BunRuntime.runMain(Effect.fail("boom"), { disableErrorReporting: true })
    `,
  ], {
    stdout: "ignore",
    stderr: "pipe",
  })

  test
    .expect(await child.exited)
    .toBe(1)
})
