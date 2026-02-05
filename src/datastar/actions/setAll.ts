import { action } from "../engine.ts"
import {
  filtered,
  mergePatch,
  startPeeking,
  stopPeeking,
} from "../engine.ts"
import type { SignalFilterOptions } from "../engine.ts"
import { updateLeaves } from "../utils.ts"

action({
  name: "setAll",
  apply(_, value: any, filter: SignalFilterOptions) {
    startPeeking()
    const masked = filtered(filter)
    updateLeaves(masked, () => value)
    mergePatch(masked)
    stopPeeking()
  },
})
