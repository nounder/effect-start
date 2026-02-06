import {
  attribute,
  beginBatch,
  endBatch,
  type HTMLOrSVG,
} from "../engine.ts"
import {
  clamp,
  modifyTiming,
  modifyViewTransition,
} from "../utils.ts"

const once = new WeakSet<HTMLOrSVG>()

attribute({
  name: "on-intersect",
  requirement: {
    key: "denied",
    value: "must",
  },
  apply({ el, mods, rx }) {
    let callback = () => {
      beginBatch()
      rx()
      endBatch()
    }
    callback = modifyViewTransition(callback, mods)
    callback = modifyTiming(callback, mods)
    const options = { threshold: 0 }
    if (mods.has("full")) {
      options.threshold = 1
    } else if (mods.has("half")) {
      options.threshold = 0.5
    } else if (mods.get("threshold")) {
      options.threshold = clamp(Number(mods.get("threshold")), 0, 100) / 100
    }
    const exit = mods.has("exit")
    let observer: IntersectionObserver | null = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting !== exit) {
            callback()
            if (observer && once.has(el)) {
              observer.disconnect()
            }
          }
        }
      },
      options,
    )
    observer.observe(el)
    if (mods.has("once")) {
      once.add(el)
    }
    return () => {
      if (!mods.has("once")) {
        once.delete(el)
      }
      if (observer) {
        observer.disconnect()
        observer = null
      }
    }
  },
})
