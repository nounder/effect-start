import {
  action,
  filtered,
  mergePatch,
  startPeeking,
  stopPeeking,
  type SignalFilterOptions,
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
