import * as Function from "effect/Function"
import * as GlobalValue from "effect/GlobalValue"
import * as PlatformRuntime from "../PlatformRuntime.ts"

const keepAlive = GlobalValue.globalValue(
  Symbol.for("effect-start/BunRuntime/keepAlive"),
  () => ({
    current: undefined as any,
  }),
)

console.log("keep alive ")

if (keepAlive.current) {
  console.log("keep alive claer")
  clearInterval(keepAlive.current)
}

export const runMain = PlatformRuntime.makeRunMain(({
  fiber,
  teardown,
}) => {
  keepAlive.current = setInterval(Function.constVoid, 2 ** 31 - 1)
  let receivedSignal = false

  fiber.addObserver((exit) => {
    if (!receivedSignal) {
      process.removeListener("SIGINT", onSigint)
      process.removeListener("SIGTERM", onSigint)
    }
    clearInterval(keepAlive.current)
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
})
