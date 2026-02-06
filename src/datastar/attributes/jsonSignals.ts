import {
  attribute,
  effect,
  filtered,
  type SignalFilterOptions,
} from "../engine.ts"
import { jsStrToObject } from "../utils.ts"

attribute({
  name: "json-signals",
  requirement: {
    key: "denied",
  },
  apply({ el, value, mods }) {
    const spaces = mods.has("terse") ? 0 : 2
    let filters: SignalFilterOptions = {}
    if (value) {
      filters = jsStrToObject(value)
    }

    const callback = () => {
      observer.disconnect()
      el.textContent = JSON.stringify(filtered(filters), null, spaces)
      observer.observe(el, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    }
    const observer = new MutationObserver(callback)
    const cleanup = effect(callback)

    return () => {
      observer.disconnect()
      cleanup()
    }
  },
})
