import { attribute, effect } from "../engine.ts"

attribute({
  name: "effect",
  requirement: {
    key: "denied",
    value: "must",
  },
  apply: ({ rx }) => {
    let userCleanup: unknown
    const dispose = effect(() => {
      if (typeof userCleanup === "function") userCleanup()
      userCleanup = rx()
    })
    return () => {
      dispose()
      if (typeof userCleanup === "function") userCleanup()
    }
  },
})
