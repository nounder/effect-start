import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FiberRef from "effect/FiberRef"
import * as HashSet from "effect/HashSet"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as MutableRef from "effect/MutableRef"
import * as Ref from "effect/Ref"

export type TestLoggerContext = {
  messages: Ref.Ref<Array<string>>
}

export class TestLogger extends Context.Tag("effect-start/TestLogger")<
  TestLogger,
  TestLoggerContext
>() {}

export function layer(): Layer.Layer<TestLogger> {
  return Layer.effect(
    TestLogger,
    Effect.gen(function* () {
      const messages = yield* Ref.make<Array<string>>([])
      const mutableRef = (messages as any).ref as MutableRef.MutableRef<Array<string>>

      const customLogger = Logger.make((options) => {
        const causeStr = !Cause.isEmpty(options.cause)
          ? ` ${Cause.pretty(options.cause, { renderErrorCause: true })}`
          : ""
        MutableRef.update(mutableRef, (msgs) => [
          ...msgs,
          `[${options.logLevel._tag}] ${String(options.message)}${causeStr}`,
        ])
      })

      yield* FiberRef.update(FiberRef.currentLoggers, (loggers) =>
        HashSet.add(HashSet.remove(loggers, Logger.defaultLogger), customLogger),
      )

      return { messages }
    }),
  )
}

export const messages: Effect.Effect<Array<string>, never, TestLogger> = Effect.gen(function* () {
  const logger = yield* TestLogger
  return yield* Ref.get(logger.messages)
})
