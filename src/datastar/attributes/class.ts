import { attribute } from "../engine.ts"
import { effect } from "../engine.ts"
import { modifyCasing } from "../utils.ts"

attribute({
  name: "class",
  requirement: {
    value: "must",
  },
  returnsValue: true,
  apply({ key, el, mods, rx }) {
    key &&= modifyCasing(key, mods, "kebab")

    let classes: Record<string, boolean>
    const callback = () => {
      observer.disconnect()

      classes = key
        ? { [key]: rx() as boolean }
        : (rx() as Record<string, boolean>)

      for (const k in classes) {
        const classNames = k.split(/\s+/).filter((cn) => cn.length > 0)
        if (classes[k]) {
          for (const name of classNames) {
            if (!el.classList.contains(name)) {
              el.classList.add(name)
            }
          }
        } else {
          for (const name of classNames) {
            if (el.classList.contains(name)) {
              el.classList.remove(name)
            }
          }
        }
      }

      observer.observe(el, { attributeFilter: ["class"] })
    }

    const observer = new MutationObserver(callback)
    const cleanup = effect(callback)

    return () => {
      observer.disconnect()
      cleanup()

      for (const k in classes) {
        const classNames = k.split(/\s+/).filter((cn) => cn.length > 0)
        for (const name of classNames) {
          el.classList.remove(name)
        }
      }
    }
  },
})
