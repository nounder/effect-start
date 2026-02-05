import { attribute } from "../engine.ts"
import {
  beginBatch,
  endBatch,
} from "../engine.ts"
import {
  modifyViewTransition,
  tagHas,
  tagToMs,
} from "../utils.ts"

attribute({
  name: "on-interval",
  requirement: {
    key: "denied",
    value: "must",
  },
  apply({ mods, rx }) {
    let callback = () => {
      beginBatch()
      rx()
      endBatch()
    }
    callback = modifyViewTransition(callback, mods)
    let duration = 1000
    const durationArgs = mods.get("duration")
    if (durationArgs) {
      duration = tagToMs(durationArgs)
      const leading = tagHas(durationArgs, "leading", false)
      if (leading) {
        callback()
      }
    }
    const intervalId = setInterval(callback, duration)
    return () => {
      clearInterval(intervalId)
    }
  },
})
