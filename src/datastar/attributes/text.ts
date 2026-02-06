import { attribute, effect } from "../engine.ts"

attribute({
  name: "text",
  requirement: {
    key: "denied",
    value: "must",
  },
  returnsValue: true,
  apply({ el, rx }) {
    const update = () => {
      observer.disconnect()
      el.textContent = `${rx()}`
      observer.observe(el, {
        childList: true,
        characterData: true,
        subtree: true,
      })
    }

    const observer = new MutationObserver(update)
    const cleanup = effect(update)

    return () => {
      observer.disconnect()
      cleanup()
    }
  },
})
