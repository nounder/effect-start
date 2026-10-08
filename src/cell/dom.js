import { createExpansion } from "./internal/expand.js"
import { createLimit } from "./internal/limit.js"
import { patchElements } from "./internal/patch.js"
import { createRequest } from "./internal/request.js"
import { createSignals } from "./internal/signals.js"
import { morph } from "./morph.js"

const runtimes = new WeakMap()

/**
 * Observe data-cell functions. Imports are inert; call start after the DOM exists.
 * @param {Document | Element | ShadowRoot} [root]
 * @param {import("./types.ts").StartOptions} [options]
 * @returns {import("./types.ts").Runtime}
 */
export const start = (root = document, options = {}) => {
  if (runtimes.has(root)) return runtimes.get(root)
  const document = root.nodeType === 9 ? root : root.ownerDocument
  const window = document.defaultView
  const signals = createSignals(options.signals)
  const mounted = new Map()
  const scopes = new WeakMap()
  const expansions = new Map()
  let stopped = false
  const report = options.onError ?? ((error) => {
    if (window.reportError) window.reportError(error)
    else {
      window.setTimeout(() => {
        throw error
      }, 0)
    }
  })

  const dispose = (target) => {
    const state = mounted.get(target)
    if (!state) return
    mounted.delete(target)
    state.controller.abort()
    for (const cleanup of Array.from(state.cleanups).reverse()) {
      try {
        cleanup()
      } catch (error) {
        report(error, target)
      }
    }
  }

  const disposeTree = (node) => {
    const descendants = node.querySelectorAll?.("*") ?? []
    dispose(node)
    for (const target of descendants) dispose(target)
  }

  const setup = (target) => {
    if (stopped) return
    const source = target.getAttribute("data-cell")
    if (mounted.get(target)?.source === source) return
    dispose(target)
    if (source === null) return
    const controller = new window.AbortController()
    const cleanups = new Set()
    let scope
    let stopExpansion
    for (let node = target; node; node = node.parentNode) {
      if (scopes.has(node)) {
        scope = scopes.get(node)
        break
      }
    }
    mounted.set(target, { source, controller, cleanups })
    const own = (cleanup) => {
      if (controller.signal.aborted) {
        cleanup()
        return () => {}
      }
      const remove = () => {
        if (cleanups.delete(remove)) cleanup()
      }
      cleanups.add(remove)
      return remove
    }
    /** @type {import("./types.ts").Cell} */
    const cell = {
      target,
      get signals() {
        return signals.values
      },
      set signals(value) {
        signals.values = value
      },
      get item() {
        return scope?.item
      },
      get index() {
        return scope?.index
      },
      abortSignal: controller.signal,
      move(destination, position = "append") {
        if (controller.signal.aborted) return
        const parent = typeof destination === "string" ? document.querySelector(destination) : destination
        if (!(parent instanceof window.Element)) throw new TypeError(`Cell move destination not found: ${destination}`)
        if (parent === target) return
        if (position === "replace") parent.replaceWith(target)
        else parent[position](target)
      },
      morph(destination, mode = "outer") {
        if (controller.signal.aborted) return
        const receiver = typeof destination === "string" ? document.querySelector(destination) : destination
        if (!(receiver instanceof window.Element)) {
          throw new TypeError(`Cell morph destination not found: ${destination}`)
        }
        if (receiver === target) return
        const content = target.cloneNode(true)
        content.removeAttribute("data-cell")
        if (mode === "outer") {
          if (receiver.hasAttribute("data-cell")) content.setAttribute("data-cell", receiver.getAttribute("data-cell"))
          morph(receiver, content)
        } else {
          const children = document.createDocumentFragment()
          children.append(...content.childNodes)
          morph(receiver, children, "inner")
        }
      },
      on(name, handler, options) {
        if (controller.signal.aborted) return () => {}
        const listener = (event) => {
          try {
            const result = handler(event)
            if (result && typeof result.then === "function") result.catch((error) => report(error, target))
          } catch (error) {
            report(error, target)
          }
        }
        target.addEventListener(name, listener, options)
        return own(() => target.removeEventListener(name, listener, options))
      },
      effect(fn) {
        if (controller.signal.aborted) return () => {}
        return own(signals.effect(fn, (error) => report(error, target)))
      },
      limit(fn, options) {
        const limit = createLimit(fn, options, window, (error) => report(error, target))
        own(limit.stop)
        return limit.run
      },
      expand(source) {
        if (!(target instanceof window.HTMLTemplateElement)) {
          throw new TypeError("cell.expand requires a <template> element")
        }
        if (controller.signal.aborted) return () => {}
        stopExpansion?.()
        const expansion = createExpansion(
          target,
          source,
          scope,
          signals,
          scopes,
          disposeTree,
          (error) => report(error, target),
        )
        expansions.set(target, expansion)
        stopExpansion = own(() => {
          expansions.delete(target)
          expansion.stop()
        })
        return stopExpansion
      },
      request: createRequest(target, controller.signal, signals, applyPatch),
    }
    try {
      const run = window.Function(`"use strict"; return (${source}\n)`)()
      if (typeof run !== "function") throw new TypeError("data-cell must evaluate to a function")
      const cleanup = run(cell)
      if (typeof cleanup === "function") own(cleanup)
      else if (cleanup && typeof cleanup.then === "function") {
        cleanup.catch((error) => report(error, target))
        throw new TypeError("data-cell setup must be synchronous; use async event handlers")
      }
    } catch (error) {
      dispose(target)
      report(error, target)
    }
  }

  const applyPatch = (html) =>
    patchElements(document, html, (element) => {
      setup(element)
      if (!root.contains(element)) dispose(element)
    })

  const mount = (target) => {
    if (root.contains(target)) setup(target)
  }

  const scan = (node) => {
    if (node.nodeType === 1 && node.hasAttribute("data-cell")) mount(node)
    for (const target of node.querySelectorAll?.("[data-cell]") ?? []) mount(target)
  }

  const observer = new window.MutationObserver((records) => {
    // Match against the final tree: keyed nodes may be removed and reinserted during one morph.
    for (const target of mounted.keys()) {
      if (!root.contains(target)) dispose(target)
    }
    for (const record of records) {
      if (record.type === "attributes") mount(record.target)
      else for (const node of record.addedNodes) scan(node)
    }
    for (const entry of expansions) {
      try {
        entry[1].refresh()
      } catch (error) {
        report(error, entry[0])
      }
    }
  })
  const runtime = {
    get signals() {
      return signals.values
    },
    stop() {
      if (stopped) return
      stopped = true
      observer.disconnect()
      for (const target of mounted.keys()) dispose(target)
      runtimes.delete(root)
    },
  }
  runtimes.set(root, runtime)
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-cell"] })
  scan(root)
  return runtime
}
