import * as Cause from "effect/Cause"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as Ref from "effect/Ref"

export type TestLoggerContext = {
  messages: Ref.Ref<Array<string>>
}

export class TestLogger extends Context.Service<TestLogger, TestLoggerContext>()("effect-start/TestLogger") {}

export function layer(): Layer.Layer<TestLogger> {
  const messages = Ref.makeUnsafe<Array<string>>([])
  const customLogger = Logger.make((options) => {
    const causeStr = options.cause !== undefined
      ? ` ${Cause.pretty(options.cause)}`
      : ""
    Ref
      .update(messages, (items) => [
        ...items,
        `[${options.logLevel}] ${String(options.message)}${causeStr}`,
      ])
      .pipe(Effect.runSync)
  })
  return Layer.merge(
    Layer.succeed(TestLogger, { messages }),
    Logger.layer([customLogger]),
  )
}

export const messages: Effect.Effect<Array<string>, never, TestLogger> = Effect
  .gen(function*() {
    const logger = yield* TestLogger
    return yield* Ref.get(logger.messages)
  })
