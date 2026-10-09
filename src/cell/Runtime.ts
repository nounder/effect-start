import { createExpansion, type Scope } from "./internal/expand.ts"
import { createLimit } from "./internal/limit.ts"
import { patchElements } from "./internal/patch.ts"
import { createRequest } from "./internal/request.ts"
import { createSignals } from "./internal/signals.ts"
import type { Cell, CellDeclaration, CellFunction, Runtime, StartOptions } from "./types.ts"

const runtimes = new WeakMap<Document | Element | ShadowRoot, Runtime>()

/**
 * Initialize and observe data-cell behavior on the DOM.
 */
export const start = (root: Document | Element | ShadowRoot = document, options: StartOptions = {}): Runtime => {
  if (runtimes.has(root)) return runtimes.get(root)!
  const document = root.nodeType === 9 ? root as Document : root.ownerDocument!
  const window = document.defaultView!
  const signals = createSignals(options.signals)
  const mounted = new Map<Node, {
    source: string
    controller: AbortController
    cleanups: Set<() => void>
  }>()
  const scopes = new WeakMap<Node, Scope>()
  const expansions = new Map<HTMLTemplateElement, ReturnType<typeof createExpansion>>()
  let stopped = false
  const report = options.onError ?? ((error) => {
    if (window.reportError) window.reportError(error)
    else {
      window.setTimeout(() => {
        throw error
      }, 0)
    }
  })

  const dispose = (target: Node) => {
    const state = mounted.get(target)
    if (!state) return
    mounted.delete(target)
    state.controller.abort()
    for (const cleanup of Array.from(state.cleanups).reverse()) {
      try {
        cleanup()
      } catch (error) {
        report(error, target as Element)
      }
    }
  }

  const disposeTree = (node: Node) => {
    const descendants = (node as ParentNode).querySelectorAll?.("*") ?? []
    dispose(node)
    for (const target of descendants) dispose(target)
  }

  const setup = (target: Element) => {
    if (stopped || !root.contains(target)) return
    const source = target.getAttribute("data-cell")
    if (mounted.get(target)?.source === source) return
    dispose(target)
    if (source === null) return
    const controller = new window.AbortController()
    const cleanups = new Set<() => void>()
    let scope: Scope | undefined
    let stopExpansion: (() => void) | undefined
    for (let node: Node | null = target; node; node = node.parentNode) {
      if (scopes.has(node)) {
        scope = scopes.get(node)
        break
      }
    }
    mounted.set(target, { source, controller, cleanups })
    const own = (cleanup: () => void) => {
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
    const cell: Cell = {
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
      on<E extends Event>(
        name: string,
        handler: (event: E) => unknown,
        options?: AddEventListenerOptions | boolean,
      ) {
        if (controller.signal.aborted) return () => {}
        const listener = (event: Event) => {
          try {
            const result = handler(event as E)
            if (result && typeof (result as PromiseLike<unknown>).then === "function") {
              ;(result as Promise<unknown>).catch((error) => report(error, target))
            }
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
      request: createRequest(target, controller.signal, signals, (html) => patchElements(document, html)),
    }
    try {
      const declaration = window.Function(`"use strict"; return (${source}\n)`)() as CellFunction | CellDeclaration
      const cleanup = (typeof declaration === "function" ? declaration : declaration.setup)?.(cell)
      if (cleanup) own(cleanup)
    } catch (error) {
      dispose(target)
      report(error, target)
    }
  }

  const scan = (node: Node) => {
    if (node.nodeType === 1 && (node as Element).hasAttribute("data-cell")) setup(node as Element)
    for (const target of (node as ParentNode).querySelectorAll?.("[data-cell]") ?? []) setup(target)
  }

  const observer = new window.MutationObserver((records) => {
    // Match against the final tree: keyed nodes may be removed and reinserted during one morph.
    for (const target of mounted.keys()) {
      if (!root.contains(target)) dispose(target)
    }
    for (const record of records) {
      if (record.type === "attributes") setup(record.target as Element)
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
