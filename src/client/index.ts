/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import type {
  BundleEvent,
  BundleManifest,
} from "../Bundle.ts"

const ScrollKey = "__effect-bundler-scroll__"

type Anchor = {
  selector: string
  offset: number
}

type ScrollState = {
  scrollY: number
  anchors: Anchor[]
}

function selectorFromElement(element: Element): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`
  }
  const parts: string[] = []
  let current: Element | null = element

  while (current && current !== document.body) {
    const parent = current.parentElement
    if (!parent) break
    const index = Array
      .from(parent.children)
      .indexOf(current) + 1
    parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`)
    current = parent
  }

  return parts.join(" > ")
}

function saveScrollState() {
  const anchors: Anchor[] = []
  const step = window.innerHeight / 4

  for (let i = 1; i <= 3; i++) {
    const y = step * i
    const element = document.elementFromPoint(0, y)
    if (!element) continue
    const target = element.id
      ? element
      : element.closest("[id]") ?? element

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

function restoreScrollState() {
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
  }, 300)

  observer = new MutationObserver(() => {
    if (stableTimer) clearTimeout(stableTimer)
    stableTimer = setTimeout(() => {
      observer.disconnect()
      clearTimeout(deadline)
      apply()
    }, 50)
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
  }, 50)
}

function reload() {
  saveScrollState()
  window.location.reload()
}

async function loadAllEntrypoints() {
  const manifest: BundleManifest = await fetch("/_bundle/manifest.json")
    .then(v => v.json())

  Object
    .keys(manifest.artifacts)
    .filter(v => v.endsWith(".js"))
    .forEach((outFile) => {
      console.log(outFile)
      const script = document.createElement("script")
      script.src = `/_bundle/${outFile}`
      script.type = "module"
      script.onload = () => {
        console.debug("Bundle reloaded")
      }
      document.body.appendChild(script)
    })
}

function handleBundleEvent(event: BundleEvent) {
  if (event.type === "Change") {
    console.debug("Bundle change detected...")
    reload()
  }
}

function listen() {
  const eventSource = new EventSource("/_bundle/events")

  eventSource.addEventListener("message", (event) => {
    try {
      reloadAllMetaLinks()
      const data = JSON.parse(event.data)

      handleBundleEvent(data)
    } catch (error) {
      console.error("Error parsing SSE event", {
        error,
        event,
      })
    }
  })

  eventSource.addEventListener("error", error => {
    console.error("SSE connection error:", error)
  })

  return () => {
    eventSource.close()
  }
}

function reloadAllMetaLinks() {
  for (const link of document.getElementsByTagName("link")) {
    const url = new URL(link.href)

    if (url.host === window.location.host) {
      const next = link.cloneNode() as HTMLLinkElement
      // TODO: this won't work when link already has query params
      next.href = next.href + "?" + Math.random().toString(36).slice(2)
      next.onload = () => link.remove()
      link.parentNode!.insertBefore(next, link.nextSibling)
      return
    }
  }
}

if (process.env.NODE_ENV !== "production") {
  window.addEventListener("load", () => {
    restoreScrollState()
    listen()
  })
}

export {
  listen,
}
