import type * as Fiber from "effect/Fiber"
import * as GlobalValue from "effect/GlobalValue"
import * as MutableRef from "effect/MutableRef"
import * as PlatformRuntime from "../PlatformRuntime.ts"

const mainFiber = GlobalValue.globalValue(Symbol.for("effect-start/BunRuntime/existingFiber"), () =>
  MutableRef.make<Fiber.RuntimeFiber<unknown, unknown> | undefined>(undefined),
)

export const runMain = PlatformRuntime.makeRunMain(({ fiber, teardown }) => {
  const prevFiber = MutableRef.get(mainFiber)

  MutableRef.set(mainFiber, fiber)

  let receivedSignal = false

  fiber.addObserver((exit) => {
    if (!receivedSignal) {
      process.removeListener("SIGINT", onSigint)
      process.removeListener("SIGTERM", onSigint)
    }
    teardown(exit, (code) => {
      if (receivedSignal || code !== 0) {
        process.exit(code)
      }
    })
  })

  function onSigint() {
    receivedSignal = true
    process.removeListener("SIGINT", onSigint)
    process.removeListener("SIGTERM", onSigint)
    fiber.unsafeInterruptAsFork(fiber.id())
  }

  process.on("SIGINT", onSigint)
  process.on("SIGTERM", onSigint)

  if (prevFiber) {
    prevFiber.unsafeInterruptAsFork(prevFiber.id())
  }
})
