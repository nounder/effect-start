import { attribute, computed, createDataEvent, mergePatch, mergePaths } from "../engine.ts"
import { modifyCasing, updateLeaves } from "../utils.ts"

attribute({
  name: "computed",
  requirement: {
    value: "must",
  },
  returnsValue: true,
  apply({ el, key, mods, rx, error }) {
    if (key) {
      mergePaths([[modifyCasing(key, mods), computed(rx)]])
    } else {
      const patch = Object.assign({}, rx() as Record<string, () => any>)
      updateLeaves(patch, (old) => {
        if (typeof old === "function") {
          return computed(() => old(createDataEvent({ el, cleanups: new Map(), error: () => error })))
        } else {
          throw error("ComputedExpectedFunction")
        }
      })
      mergePatch(patch)
    }
  },
})
