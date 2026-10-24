import { mergePatch, watcher } from "../engine.ts"
import { jsStrToObject } from "../utils.ts"

watcher({
  name: "datastar-patch-signals",
  apply({ error }, { signals, onlyIfMissing }) {
    if (typeof signals !== "string") {
      throw error("PatchSignalsExpectedSignals")
    }

    const ifMissing = typeof onlyIfMissing === "string" && onlyIfMissing.trim() === "true"
    mergePatch(jsStrToObject(signals), { ifMissing })
  },
})
