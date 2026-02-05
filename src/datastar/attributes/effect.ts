import { attribute } from "../engine.ts"
import { effect } from "../engine.ts"

attribute({
  name: "effect",
  requirement: {
    key: "denied",
    value: "must",
  },
  apply: ({ rx }) => effect(rx),
})
