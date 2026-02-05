import { DATASTAR_SIGNAL_PATCH_EVENT } from "../engine.ts"
import { attribute } from "../engine.ts"
import {
  beginBatch,
  endBatch,
  filtered,
} from "../engine.ts"
import type {
  JSONPatch,
  SignalFilterOptions,
} from "../engine.ts"
import {
  aliasify,
  isEmpty,
  jsStrToObject,
  modifyTiming,
} from "../utils.ts"

attribute({
  name: "on-signal-patch",
  requirement: {
    value: "must",
  },
  argNames: ["patch"],
  returnsValue: true,
  apply({ el, key, mods, rx, error }) {
    if (!!key && key !== "filter") {
      throw error("KeyNotAllowed")
    }

    const filterAttr = aliasify(`${this.name}-filter`)
    const filtersRaw = el.getAttribute(filterAttr)
    let filters: SignalFilterOptions = {}
    if (filtersRaw) {
      filters = jsStrToObject(filtersRaw)
    }

    let running = false

    const callback: EventListener = modifyTiming(
      (evt: CustomEvent<JSONPatch>) => {
        if (running) return
        const watched = filtered(filters, evt.detail)
        if (!isEmpty(watched)) {
          running = true
          beginBatch()
          try {
            rx(watched)
          } finally {
            endBatch()
            running = false
          }
        }
      },
      mods,
    )

    document.addEventListener(DATASTAR_SIGNAL_PATCH_EVENT, callback)
    return () => {
      document.removeEventListener(DATASTAR_SIGNAL_PATCH_EVENT, callback)
    }
  },
})
