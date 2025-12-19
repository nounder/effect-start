import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as BunHttpServer from "./BunHttpServer.ts"

test.describe("BunHttpServer smart port selection", () => {
  // Skip when running in TTY because the random port logic requires !isTTY && CLAUDECODE,
  // and process.stdout.isTTY cannot be mocked
  test.test.skipIf(process.stdout.isTTY)(
    "uses random port when PORT not set, isTTY=false, CLAUDECODE set",
    async () => {
      const originalPort = process.env.PORT
      const originalClaudeCode = process.env.CLAUDECODE

      try {
        delete process.env.PORT
        process.env.CLAUDECODE = "1"

        const port = await Effect.runPromise(
          Effect.scoped(
            Effect.gen(function*() {
              const bunServer = yield* BunHttpServer.make({})
              return bunServer.server.port
            }),
          ),
        )

        test
          .expect(port)
          .not
          .toBe(3000)
      } finally {
        if (originalPort !== undefined) {
          process.env.PORT = originalPort
        } else {
          delete process.env.PORT
        }
        if (originalClaudeCode !== undefined) {
          process.env.CLAUDECODE = originalClaudeCode
        } else {
          delete process.env.CLAUDECODE
        }
      }
    },
  )

  test.test("uses explicit PORT even when CLAUDECODE is set", async () => {
    const originalPort = process.env.PORT
    const originalClaudeCode = process.env.CLAUDECODE

    try {
      process.env.PORT = "5678"
      process.env.CLAUDECODE = "1"

      const port = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function*() {
            const bunServer = yield* BunHttpServer.make({})
            return bunServer.server.port
          }),
        ),
      )

      test
        .expect(port)
        .toBe(5678)
    } finally {
      if (originalPort !== undefined) {
        process.env.PORT = originalPort
      } else {
        delete process.env.PORT
      }
      if (originalClaudeCode !== undefined) {
        process.env.CLAUDECODE = originalClaudeCode
      } else {
        delete process.env.CLAUDECODE
      }
    }
  })
})
