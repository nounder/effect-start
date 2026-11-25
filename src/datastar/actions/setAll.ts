import {
  action,
  filtered,
  mergePatch,
  type SignalFilterOptions,
  startPeeking,
  stopPeeking,
} from "../engine.ts"
import { updateLeaves } from "../utils.ts"

action({
  name: "setAll",
  apply(_, value: unknown, filter: SignalFilterOptions) {
    startPeeking()
    const masked = filtered(filter)
    updateLeaves(masked, () => value)
    mergePatch(masked)
    stopPeeking()
  },
})
