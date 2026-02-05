import { attribute } from "../engine.ts"
import { effect } from "../engine.ts"

const NONE = "none"
const DISPLAY = "display"

attribute({
  name: "show",
  requirement: {
    key: "denied",
    value: "must",
  },
  returnsValue: true,
  apply({ el, rx }) {
    const update = () => {
      observer.disconnect()
      const shouldShow = rx()
      if (shouldShow) {
        if (el.style.display === NONE) el.style.removeProperty(DISPLAY)
      } else {
        el.style.setProperty(DISPLAY, NONE)
      }
      observer.observe(el, { attributeFilter: ["style"] })
    }
    const observer = new MutationObserver(update)
    const cleanup = effect(update)

    return () => {
      observer.disconnect()
      cleanup()
    }
  },
})
