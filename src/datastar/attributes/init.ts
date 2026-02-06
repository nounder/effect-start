import { attribute, beginBatch, endBatch } from "../engine.ts"
import { delay, modifyViewTransition, tagToMs } from "../utils.ts"

attribute({
  name: "init",
  requirement: {
    key: "denied",
    value: "must",
  },
  apply({ rx, mods }) {
    let callback = () => {
      beginBatch()
      rx()
      endBatch()
    }
    callback = modifyViewTransition(callback, mods)
    let wait = 0
    const delayArgs = mods.get("delay")
    if (delayArgs) {
      wait = tagToMs(delayArgs)
      if (wait > 0) {
        callback = delay(callback, wait)
      }
    }
    callback()
  },
})
