import {
  attribute,
  mergePatch,
  mergePaths,
} from "../engine.ts"
import { modifyCasing } from "../utils.ts"

attribute({
  name: "signals",
  returnsValue: true,
  apply({ key, mods, rx }) {
    const ifMissing = mods.has("ifmissing")

    if (key) {
      key = modifyCasing(key, mods)
      mergePaths([[key, rx?.()]], { ifMissing })
    } else {
      const patch = Object.assign({}, rx?.() as Record<string, any>)
      mergePatch(patch, { ifMissing })
    }
  },
})
