import { attribute, computed, mergePatch, mergePaths } from "../engine.ts"
import { modifyCasing, updateLeaves } from "../utils.ts"

attribute({
  name: "computed",
  requirement: {
    value: "must",
  },
  returnsValue: true,
  apply({ key, mods, rx, error }) {
    if (key) {
      mergePaths([[modifyCasing(key, mods), computed(rx)]])
    } else {
      const patch = Object.assign({}, rx() as Record<string, () => any>)
      updateLeaves(patch, (old) => {
        if (typeof old === "function") {
          return computed(old)
        } else {
          throw error("ComputedExpectedFunction")
        }
      })
      mergePatch(patch)
    }
  },
})
