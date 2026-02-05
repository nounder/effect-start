import { DATASTAR_FETCH_EVENT } from "../engine.ts"
import { attribute } from "../engine.ts"
import { mergePaths } from "../engine.ts"
import type { DatastarFetchEvent } from "../engine.ts"
import { modifyCasing } from "../utils.ts"
import {
  FINISHED,
  STARTED,
} from "../actions/fetch.ts"

attribute({
  name: "indicator",
  requirement: "exclusive",
  apply({ el, key, mods, value }) {
    const signalName = key != null ? modifyCasing(key, mods) : value

    mergePaths([[signalName, false]])

    const watcher = ((event: CustomEvent<DatastarFetchEvent>) => {
      const { type, el: elt } = event.detail
      if (elt !== el) {
        return
      }
      switch (type) {
        case STARTED:
          mergePaths([[signalName, true]])
          break
        case FINISHED:
          mergePaths([[signalName, false]])
          break
      }
    }) as EventListener
    document.addEventListener(DATASTAR_FETCH_EVENT, watcher)
    return () => {
      mergePaths([[signalName, false]])
      document.removeEventListener(DATASTAR_FETCH_EVENT, watcher)
    }
  },
})
