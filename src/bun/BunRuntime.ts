import * as Runtime from "effect/Runtime"
import * as MainFiber from "./internal/MainFiber.ts"

export const runMain = Runtime.makeRunMain((options) => {
  const previous = MainFiber.get()
  MainFiber.set(options.fiber)
  let receivedSignal = false

  options.fiber.addObserver((exit) => {
    const isCurrent = MainFiber.get() === options.fiber
    MainFiber.clear(options.fiber)
    process.removeListener("SIGINT", onSignal)
    process.removeListener("SIGTERM", onSignal)
    if (!isCurrent) return
    options.teardown(exit, (code) => {
      if (receivedSignal || code !== 0) process.exit(code)
    })
  })

  function onSignal() {
    receivedSignal = true
    options.fiber.interruptUnsafe(options.fiber.id)
  }

  process.on("SIGINT", onSignal)
  process.on("SIGTERM", onSignal)
  previous?.interruptUnsafe(previous.id)
})
