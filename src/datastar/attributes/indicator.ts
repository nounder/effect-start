import { FINISHED, STARTED } from "../actions/fetch.ts"
import {
  attribute,
  DATASTAR_FETCH_EVENT,
  type DatastarFetchEvent,
  mergePaths,
} from "../engine.ts"
import { modifyCasing } from "../utils.ts"

attribute({
  name: "indicator",
  requirement: "exclusive",
  apply({ el, key, mods, value }) {
    const signalName = key != null ? modifyCasing(key, mods) : value
    let activeFetches = 0

    mergePaths([[signalName, false]])

    const watcher = ((event: CustomEvent<DatastarFetchEvent>) => {
      const { type, el: elt } = event.detail
      if (elt !== el) {
        return
      }
      switch (type) {
        case STARTED:
          activeFetches++
          mergePaths([[signalName, true]])
          break
        case FINISHED:
          activeFetches = Math.max(0, activeFetches - 1)
          mergePaths([[signalName, activeFetches > 0]])
          break
      }
    }) as EventListener
    document.addEventListener(DATASTAR_FETCH_EVENT, watcher)
    return () => {
      activeFetches = 0
      mergePaths([[signalName, false]])
      document.removeEventListener(DATASTAR_FETCH_EVENT, watcher)
    }
  },
})
