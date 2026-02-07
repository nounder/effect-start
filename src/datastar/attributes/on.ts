import {
  attribute,
  beginBatch,
  DATASTAR_FETCH_EVENT,
  DATASTAR_SIGNAL_PATCH_EVENT,
  endBatch,
  type Modifiers,
} from "../engine.ts"
import { modifyTiming, modifyViewTransition } from "../utils.ts"

// TODO: support leading/trailing options for debounce/throttle
// e.g. { debounce: { ms: 500, leading: true, noTrailing: true } }
const configToMods = (config: Record<string, any>): Modifiers => {
  const mods: Modifiers = new Map()
  for (const [k, v] of Object.entries(config)) {
    if (v === true) {
      mods.set(k, new Set())
    } else if (typeof v === "number") {
      mods.set(k, new Set([`${v}ms`]))
    }
  }
  return mods
}

attribute({
  name: "on",
  requirement: "must",
  argNames: ["evt"],
  apply({ el, key, mods, rx, value }) {
    let userFn: Function | undefined
    let effectiveMods = mods

    try {
      const parts = Function(`return [${value}]`)()
      if (typeof parts[0] === "function") {
        userFn = parts[0]
        if (parts[1]) effectiveMods = configToMods(parts[1])
      }
    } catch {}

    let target: Element | Window | Document = el
    if (effectiveMods.has("window")) target = window
    let callback = (evt?: Event) => {
      if (evt) {
        if (effectiveMods.has("prevent")) evt.preventDefault()
        if (effectiveMods.has("stop")) evt.stopPropagation()
      }
      beginBatch()
      userFn ? userFn(evt) : rx(evt)
      endBatch()
    }
    callback = modifyViewTransition(callback, effectiveMods)
    callback = modifyTiming(callback, effectiveMods)
    const evtListOpts: AddEventListenerOptions = {
      capture: effectiveMods.has("capture"),
      passive: effectiveMods.has("passive"),
      once: effectiveMods.has("once"),
    }
    if (effectiveMods.has("outside")) {
      target = document
      const cb = callback
      callback = (evt?: Event) => {
        if (!el.contains(evt?.target as HTMLElement)) cb(evt)
      }
    }
    const eventName = key
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
