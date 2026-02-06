import {
  attribute,
  beginBatch,
  DATASTAR_FETCH_EVENT,
  DATASTAR_SIGNAL_PATCH_EVENT,
  endBatch,
} from "../engine.ts"
import { modifyCasing, modifyTiming, modifyViewTransition } from "../utils.ts"

attribute({
  name: "on",
  requirement: "must",
  argNames: ["evt"],
  apply({ el, key, mods, rx }) {
    let target: Element | Window | Document = el
    if (mods.has("window")) target = window
    let callback = (evt?: Event) => {
      if (evt) {
        if (mods.has("prevent")) {
          evt.preventDefault()
        }
        if (mods.has("stop")) {
          evt.stopPropagation()
        }
      }
      beginBatch()
      rx(evt)
      endBatch()
    }
    callback = modifyViewTransition(callback, mods)
    callback = modifyTiming(callback, mods)
    const evtListOpts: AddEventListenerOptions = {
      capture: mods.has("capture"),
      passive: mods.has("passive"),
      once: mods.has("once"),
    }
    if (mods.has("outside")) {
      target = document
      const cb = callback
      callback = (evt?: Event) => {
        if (!el.contains(evt?.target as HTMLElement)) {
          cb(evt)
        }
      }
    }
    const eventName = modifyCasing(key, mods, "kebab")
    if (eventName === DATASTAR_FETCH_EVENT || eventName === DATASTAR_SIGNAL_PATCH_EVENT) {
      target = document
    }
    if (el instanceof HTMLFormElement && eventName === "submit") {
      const cb = callback
      callback = (evt?: Event) => {
        evt?.preventDefault()
        cb(evt)
      }
    }
    target.addEventListener(eventName, callback, evtListOpts)
    return () => {
      target.removeEventListener(eventName, callback)
    }
  },
})
