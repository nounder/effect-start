const ScrollKey = "_BUNDLER_SCROLL"

type Anchor = {
  selector: string
  offset: number
}

type ScrollState = {
  scrollY: number
  anchors: Array<Anchor>
}

/**
 * Persist current scroll state to session storage.
 * Scroll state is saved relatively to visible elements.
 */
export function persist() {
  const anchors: Array<Anchor> = []
  const step = window.innerHeight / 4

  for (let i = 1; i <= 3; i++) {
    const y = step * i
    const element = document.elementFromPoint(0, y)
    if (!element) continue
    const target = element.id ? element : (element.closest("[id]") ?? element)

    anchors.push({
      selector: selectorFromElement(target),
      offset: target.getBoundingClientRect().top,
    })
  }

  const state: ScrollState = {
    anchors,
    scrollY: window.scrollY,
  }

  sessionStorage.setItem(ScrollKey, JSON.stringify(state))
}

export function restore() {
  const timeout = 3000
  const tick = 50
  const raw = sessionStorage.getItem(ScrollKey)
  if (!raw) return

  sessionStorage.removeItem(ScrollKey)

  const state: ScrollState = JSON.parse(raw)

  const apply = () => {
    for (const anchor of state.anchors) {
      const element = document.querySelector(anchor.selector)
      if (element) {
        const rect = element.getBoundingClientRect()
        const top = window.scrollY + rect.top - anchor.offset
        window.scrollTo({
          top,
        })
        return
      }
    }

    window.scrollTo({
      top: state.scrollY,
    })
  }

  let observer: MutationObserver
  let stableTimer: ReturnType<typeof setTimeout> | undefined
  const deadline = setTimeout(() => {
    observer.disconnect()
    if (stableTimer) clearTimeout(stableTimer)
    apply()
  }, timeout)

  observer = new MutationObserver(() => {
    if (stableTimer) clearTimeout(stableTimer)
    stableTimer = setTimeout(() => {
      observer.disconnect()
      clearTimeout(deadline)
      apply()
    }, tick)
  })

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  })

  stableTimer = setTimeout(() => {
    observer.disconnect()
    clearTimeout(deadline)
    apply()
  }, tick)
}

function selectorFromElement(element: Element): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`
  }
  const parts: Array<string> = []
  let current: Element | null = element

  while (current && current !== document.body) {
    const parent = current.parentElement
    if (!parent) break
    const index = Array.from(parent.children).indexOf(current) + 1
    parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`)
    current = parent
  }

  return parts.join(" > ")
}
