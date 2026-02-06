import { mergePatch, watcher } from "../engine.ts"
import { jsStrToObject } from "../utils.ts"

watcher({
  name: "datastar-patch-signals",
  apply({ error }, { signals, onlyIfMissing }) {
    if (signals) {
      const ifMissing = onlyIfMissing?.trim() === "true"
      mergePatch(jsStrToObject(signals), { ifMissing })
    } else {
      throw error("PatchSignalsExpectedSignals")
    }
  },
})
