import {
  attribute,
  beginBatch,
  DATASTAR_FETCH_EVENT,
  DATASTAR_SIGNAL_PATCH_EVENT,
  endBatch,
} from "../engine.ts"
import { modifyTiming, modifyViewTransition } from "../utils.ts"

attribute({
  name: "on",
  requirement: "must",
  argNames: ["evt"],
  apply({ el, key, mods, rx }) {
    let target: Element | Window | Document = el
    if (mods.has("window")) {
      target = window
    } else if (mods.has("document")) {
      target = document
    }
    let callback = (evt?: Event) => {
      beginBatch()
      rx(evt)
      endBatch()
    }
    callback = modifyViewTransition(callback, mods)
    callback = modifyTiming(callback, mods)
    const eventName = key
    const evtListOpts: AddEventListenerOptions = {
      capture: mods.has("capture"),
      passive: mods.has("passive"),
      once: mods.has("once"),
    }
    if (mods.has("outside")) {
      target = document
      const cb = callback
      callback = (evt?: Event) => {
        if (!el.contains(evt?.target as HTMLElement)) cb(evt)
      }
    }
    if (eventName === DATASTAR_FETCH_EVENT || eventName === DATASTAR_SIGNAL_PATCH_EVENT) {
      target = document
    }
    const listener = (evt?: Event) => {
      if (evt) {
        if (mods.has("prevent")) evt.preventDefault()
        if (mods.has("stop")) evt.stopPropagation()
        if (el instanceof HTMLFormElement && eventName === "submit") evt.preventDefault()
      }
      callback(evt)
    }
    target.addEventListener(eventName, listener, evtListOpts)
    return () => {
      target.removeEventListener(eventName, listener, evtListOpts)
    }
  },
})
