import {
  action,
  startPeeking,
  stopPeeking,
} from "../engine.ts"

action({
  name: "peek",
  apply(_, fn: () => any) {
    startPeeking()
    try {
      return fn()
    } finally {
      stopPeeking()
    }
  },
})
