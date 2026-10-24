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
  name: "toggleAll",
  apply(_, filter: SignalFilterOptions) {
    startPeeking()
    const masked = filtered(filter)
    updateLeaves(masked, (oldValue: any) => !oldValue)
    mergePatch(masked)
    stopPeeking()
  },
})
