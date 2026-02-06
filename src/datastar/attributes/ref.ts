import { attribute, mergePaths } from "../engine.ts"
import { modifyCasing } from "../utils.ts"

attribute({
  name: "ref",
  requirement: "exclusive",
  apply({ el, key, mods, value }) {
    const signalName = key != null ? modifyCasing(key, mods) : value
    mergePaths([[signalName, el]])
  },
})
