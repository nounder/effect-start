import * as test from "bun:test"
import * as Effect from "effect/Effect"
import * as Logger from "effect/Logger"
import * as Ref from "effect/Ref"
import * as TestLogger from "./TestLogger.ts"

test.it("TestLogger captures log messages", () =>
  Effect
    .gen(function*() {
      const logger = yield* TestLogger.TestLogger

      // Log some messages
      yield* Effect.logError("This is an error")
      yield* Effect.logWarning("This is a warning")
      yield* Effect.logInfo("This is info")

      // Read captured messages
      const messages = yield* Ref.get(logger.messages)

      test
        .expect(messages)
        .toHaveLength(3)
      test
        .expect(messages[0])
        .toContain("[Error]")
      test
        .expect(messages[0])
        .toContain("This is an error")
      test
        .expect(messages[1])
        .toContain("[Warning]")
      test
        .expect(messages[1])
        .toContain("This is a warning")
      test
        .expect(messages[2])
        .toContain("[Info]")
      test
        .expect(messages[2])
        .toContain("This is info")
    })
    .pipe(Effect.provide(TestLogger.layer()), Effect.runPromise))

test.it("TestLogger starts with empty messages", () =>
  Effect
    .gen(function*() {
      const logger = yield* TestLogger.TestLogger
      const messages = yield* Ref.get(logger.messages)

      test
        .expect(messages)
        .toHaveLength(0)
    })
    .pipe(Effect.provide(TestLogger.layer()), Effect.runPromise))
