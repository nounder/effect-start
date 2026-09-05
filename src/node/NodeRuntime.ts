import * as MutableRef from "effect/MutableRef"
import * as PlatformRuntime from "../PlatformRuntime.ts"

export const runMain = PlatformRuntime.makeRunMain((options) => {
  const prevFiber = MutableRef.get(PlatformRuntime.mainFiber)

  MutableRef.set(PlatformRuntime.mainFiber, options.fiber)

  let receivedSignal = false

  options.fiber.addObserver((exit) => {
    if (!receivedSignal) {
      process.removeListener("SIGINT", onSigint)
      process.removeListener("SIGTERM", onSigint)
    }
    options.teardown(exit, (code) => {
      if (receivedSignal || code !== 0) {
        process.exit(code)
      }
    })
  })

  function onSigint() {
    receivedSignal = true
    process.removeListener("SIGINT", onSigint)
    process.removeListener("SIGTERM", onSigint)
    options.fiber.unsafeInterruptAsFork(options.fiber.id())
  }

  process.on("SIGINT", onSigint)
  process.on("SIGTERM", onSigint)

  if (prevFiber) {
    prevFiber.unsafeInterruptAsFork(prevFiber.id())
  }
})
