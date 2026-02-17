import { watcher, type HTMLOrSVG, type WatcherContext } from "../engine.ts"
import { aliasify, isHTMLOrSVG, supportsViewTransitions } from "../utils.ts"

const isValidType = <T extends readonly string[]>(arr: T, value: string): value is T[number] =>
  (arr as ReadonlyArray<string>).includes(value)

const PATCH_MODES = [
  "remove",
  "outer",
  "inner",
  "replace",
  "prepend",
  "append",
  "before",
  "after",
] as const
type PatchElementsMode = (typeof PATCH_MODES)[number]

const NAMESPACES = ["html", "svg", "mathml"] as const
type Namespace = (typeof NAMESPACES)[number]

type PatchElementsArgs = {
  selector: string
  mode: PatchElementsMode
  namespace: Namespace
  useViewTransition: boolean
  elements: string
}

watcher({
  name: "datastar-patch-elements",
  apply(
    ctx,
    { selector = "", mode = "outer", namespace = "html", useViewTransition = "", elements = "" },
  ) {
    if (!isValidType(PATCH_MODES, mode)) {
      throw ctx.error("PatchElementsInvalidMode", { mode })
    }

    if (!selector && mode !== "outer" && mode !== "replace") {
      throw ctx.error("PatchElementsExpectedSelector")
    }

    if (!isValidType(NAMESPACES, namespace)) {
      throw ctx.error("PatchElementsInvalidNamespace", { namespace })
    }

    const args2: PatchElementsArgs = {
      selector,
      mode,
      namespace,
      useViewTransition: useViewTransition.trim() === "true",
      elements,
    }

    if (supportsViewTransitions && useViewTransition) {
      document.startViewTransition(() => onPatchElements(ctx, args2))
    } else {
      onPatchElements(ctx, args2)
    }
  },
})

const onPatchElements = (
  { error }: WatcherContext,
  { selector, mode, namespace, elements }: PatchElementsArgs,
) => {
  const elementsWithSvgsRemoved = elements.replace(/<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim, "")
  const hasHtml = /<\/html>/.test(elementsWithSvgsRemoved)
  const hasHead = /<\/head>/.test(elementsWithSvgsRemoved)
  const hasBody = /<\/body>/.test(elementsWithSvgsRemoved)

  const wrapperTag = namespace === "svg" ? "svg" : namespace === "mathml" ? "math" : ""
  const wrappedEls = wrapperTag ? `<${wrapperTag}>${elements}</${wrapperTag}>` : elements

  const newDocument = new DOMParser().parseFromString(
    hasHtml || hasHead || hasBody ? elements : `<body><template>${wrappedEls}</template></body>`,
    "text/html",
  )

  let newContent = document.createDocumentFragment()
  if (hasHtml) {
    newContent.appendChild(newDocument.documentElement)
  } else if (hasHead && hasBody) {
    newContent.appendChild(newDocument.head)
    newContent.appendChild(newDocument.body)
  } else if (hasHead) {
    newContent.appendChild(newDocument.head)
  } else if (hasBody) {
    newContent.appendChild(newDocument.body)
  } else if (wrapperTag) {
    const wrapperEl = newDocument.querySelector("template")!.content.querySelector(wrapperTag)!
    for (const child of wrapperEl.childNodes) {
      newContent.appendChild(child)
    }
  } else {
    newContent = newDocument.querySelector("template")!.content
  }

  if (!selector && (mode === "outer" || mode === "replace")) {
    for (const child of newContent.children) {
      let target: Element
      if (child instanceof HTMLHtmlElement) {
        target = document.documentElement
      } else if (child instanceof HTMLBodyElement) {
        target = document.body
      } else if (child instanceof HTMLHeadElement) {
        target = document.head
      } else {
        target = document.getElementById(child.id)!
        if (!target) {
          console.warn(error("PatchElementsNoTargetsFound"), {
            element: { id: child.id },
          })
          continue
        }
      }

      applyToTargets(mode as PatchElementsMode, child, [target])
    }
  } else {
    const targets = document.querySelectorAll(selector)
    if (!targets.length) {
      console.warn(error("PatchElementsNoTargetsFound"), { selector })
      return
    }

    applyToTargets(mode as PatchElementsMode, newContent, targets)
  }
}

const scripts = new WeakSet<HTMLScriptElement>()
for (const script of document.querySelectorAll("script")) {
  scripts.add(script)
}

const execute = (target: Element): void => {
  const elScripts =
    target instanceof HTMLScriptElement ? [target] : target.querySelectorAll("script")
  for (const old of elScripts) {
    if (!scripts.has(old)) {
      const script = document.createElement("script")
      for (const { name, value } of old.attributes) {
        script.setAttribute(name, value)
      }
      script.text = old.text
      old.replaceWith(script)
      scripts.add(script)
    }
  }
}

const applyPatchMode = (
  targets: Iterable<Element>,
  element: DocumentFragment | Element,
  action: string,
) => {
  for (const target of targets) {
    const cloned = element.cloneNode(true) as Element
    execute(cloned)
    // @ts-ignore
    target[action](cloned)
  }
}

const applyToTargets = (
  mode: PatchElementsMode,
  element: DocumentFragment | Element,
  targets: Iterable<Element>,
) => {
  switch (mode) {
    case "remove":
      for (const target of targets) {
        target.remove()
      }
      break
    case "outer":
    case "inner":
      for (const target of targets) {
        morph(target, element.cloneNode(true) as Element, mode)
        execute(target)
      }
      break
    case "replace":
      applyPatchMode(targets, element, "replaceWith")
      break
    case "prepend":
    case "append":
    case "before":
    case "after":
      applyPatchMode(targets, element, mode)
  }
}

const ctxIdMap = new Map<Node, Set<string>>()
const ctxPersistentIds = new Set<string>()
const oldIdTagNameMap = new Map<string, string>()
const duplicateIds = new Set<string>()
const ctxPantry = document.createElement("div")
ctxPantry.hidden = true

const aliasedIgnoreMorph = aliasify("ignore-morph")
const aliasedIgnoreMorphAttr = `[${aliasedIgnoreMorph}]`
const morph = (
  oldElt: Element | ShadowRoot,
  newContent: DocumentFragment | Element,
  mode: "outer" | "inner" = "outer",
): void => {
  if (
    (isHTMLOrSVG(oldElt) &&
      isHTMLOrSVG(newContent) &&
      (oldElt as HTMLOrSVG).hasAttribute(aliasedIgnoreMorph) &&
      (newContent as HTMLOrSVG).hasAttribute(aliasedIgnoreMorph)) ||
    oldElt.parentElement?.closest(aliasedIgnoreMorphAttr)
  ) {
    return
  }

  const normalizedElt = document.createElement("div")
  normalizedElt.append(newContent)
  document.body.insertAdjacentElement("afterend", ctxPantry)

  const oldIdElements = oldElt.querySelectorAll("[id]")
  for (const { id, tagName } of oldIdElements) {
    if (oldIdTagNameMap.has(id)) {
      duplicateIds.add(id)
    } else {
      oldIdTagNameMap.set(id, tagName)
    }
  }
  if (oldElt instanceof Element && oldElt.id) {
    if (oldIdTagNameMap.has(oldElt.id)) {
      duplicateIds.add(oldElt.id)
    } else {
      oldIdTagNameMap.set(oldElt.id, oldElt.tagName)
    }
  }

  ctxPersistentIds.clear()
  const newIdElements = normalizedElt.querySelectorAll("[id]")
  for (const { id, tagName } of newIdElements) {
    if (ctxPersistentIds.has(id)) {
      duplicateIds.add(id)
    } else if (oldIdTagNameMap.get(id) === tagName) {
      ctxPersistentIds.add(id)
    }
  }

  for (const id of duplicateIds) {
    ctxPersistentIds.delete(id)
  }

  oldIdTagNameMap.clear()
  duplicateIds.clear()
  ctxIdMap.clear()

  const parent = mode === "outer" ? oldElt.parentElement! : oldElt
  populateIdMapWithTree(parent, oldIdElements)
  populateIdMapWithTree(normalizedElt, newIdElements)

  morphChildren(parent, normalizedElt, mode === "outer" ? oldElt : null, oldElt.nextSibling)

  ctxPantry.remove()
}

const morphChildren = (
  oldParent: Element | ShadowRoot,
  newParent: Element,
  insertionPoint: Node | null = null,
  endPoint: Node | null = null,
): void => {
  if (oldParent instanceof HTMLTemplateElement && newParent instanceof HTMLTemplateElement) {
    oldParent = oldParent.content as unknown as Element
    newParent = newParent.content as unknown as Element
  }
  insertionPoint ??= oldParent.firstChild

  for (const newChild of newParent.childNodes) {
    if (insertionPoint && insertionPoint !== endPoint) {
      const bestMatch = findBestMatch(newChild, insertionPoint, endPoint)
      if (bestMatch) {
        if (bestMatch !== insertionPoint) {
          let cursor: Node | null = insertionPoint
          while (cursor && cursor !== bestMatch) {
            const tempNode = cursor
            cursor = cursor.nextSibling
            removeNode(tempNode)
          }
        }
        morphNode(bestMatch, newChild)
        insertionPoint = bestMatch.nextSibling
        continue
      }
    }

    if (newChild instanceof Element && ctxPersistentIds.has(newChild.id)) {
      const movedChild = document.getElementById(newChild.id) as Element

      let current = movedChild
      while ((current = current.parentNode as Element)) {
        const idSet = ctxIdMap.get(current)
        if (idSet) {
          idSet.delete(newChild.id)
          if (!idSet.size) {
            ctxIdMap.delete(current)
          }
        }
      }

      moveBefore(oldParent, movedChild, insertionPoint)
      morphNode(movedChild, newChild)
      insertionPoint = movedChild.nextSibling
      continue
    }

    if (ctxIdMap.has(newChild)) {
      const namespaceURI = (newChild as Element).namespaceURI
      const tagName = (newChild as Element).tagName
      const newEmptyChild =
        namespaceURI && namespaceURI !== "http://www.w3.org/1999/xhtml"
          ? document.createElementNS(namespaceURI, tagName)
          : document.createElement(tagName)
      oldParent.insertBefore(newEmptyChild, insertionPoint)
      morphNode(newEmptyChild, newChild)
      insertionPoint = newEmptyChild.nextSibling
    } else {
      const newClonedChild = document.importNode(newChild, true)
      oldParent.insertBefore(newClonedChild, insertionPoint)
      insertionPoint = newClonedChild.nextSibling
    }
  }

  while (insertionPoint && insertionPoint !== endPoint) {
    const tempNode = insertionPoint
    insertionPoint = insertionPoint.nextSibling
    removeNode(tempNode)
  }
}

const findBestMatch = (node: Node, startPoint: Node | null, endPoint: Node | null): Node | null => {
  let bestMatch: Node | null | undefined = null
  let nextSibling = node.nextSibling
  let siblingSoftMatchCount = 0
  let displaceMatchCount = 0

  const nodeMatchCount = ctxIdMap.get(node)?.size || 0

  let cursor = startPoint
  while (cursor && cursor !== endPoint) {
    if (isSoftMatch(cursor, node)) {
      let isIdSetMatch = false
      const oldSet = ctxIdMap.get(cursor)
      const newSet = ctxIdMap.get(node)

      if (newSet && oldSet) {
        for (const id of oldSet) {
          if (newSet.has(id)) {
            isIdSetMatch = true
            break
          }
        }
      }

      if (isIdSetMatch) {
        return cursor
      }

      if (!bestMatch && !ctxIdMap.has(cursor)) {
        if (!nodeMatchCount) {
          return cursor
        }
        bestMatch = cursor
      }
    }

    displaceMatchCount += ctxIdMap.get(cursor)?.size || 0
    if (displaceMatchCount > nodeMatchCount) {
      break
    }

    if (bestMatch === null && nextSibling && isSoftMatch(cursor, nextSibling)) {
      siblingSoftMatchCount++
      nextSibling = nextSibling.nextSibling

      if (siblingSoftMatchCount >= 2) {
        bestMatch = undefined
      }
    }

    cursor = cursor.nextSibling
  }

  return bestMatch || null
}

const isSoftMatch = (oldNode: Node, newNode: Node): boolean =>
  oldNode.nodeType === newNode.nodeType &&
  (oldNode as Element).tagName === (newNode as Element).tagName &&
  (!(oldNode as Element).id || (oldNode as Element).id === (newNode as Element).id)

const removeNode = (node: Node): void => {
  ctxIdMap.has(node) ? moveBefore(ctxPantry, node, null) : node.parentNode?.removeChild(node)
}

const moveBefore: (parentNode: Node, node: Node, after: Node | null) => void =
  removeNode.call.bind(ctxPantry.moveBefore ?? ctxPantry.insertBefore)

const aliasedPreserveAttr = aliasify("preserve-attr")

const morphNode = (oldNode: Node, newNode: Node): Node => {
  const type = newNode.nodeType

  if (type === 1) {
    const oldElt = oldNode as Element
    const newElt = newNode as Element
    const shouldScopeChildren = oldElt.hasAttribute("data-scope-children")
    if (oldElt.hasAttribute(aliasedIgnoreMorph) && newElt.hasAttribute(aliasedIgnoreMorph)) {
      return oldNode
    }

    if (
      oldElt instanceof HTMLInputElement &&
      newElt instanceof HTMLInputElement &&
      newElt.type !== "file"
    ) {
      if (newElt.getAttribute("value") !== oldElt.getAttribute("value")) {
        oldElt.value = newElt.getAttribute("value") ?? ""
      }
    } else if (oldElt instanceof HTMLTextAreaElement && newElt instanceof HTMLTextAreaElement) {
      if (newElt.value !== oldElt.value) {
        oldElt.value = newElt.value
      }
      if (oldElt.firstChild && oldElt.firstChild.nodeValue !== newElt.value) {
        oldElt.firstChild.nodeValue = newElt.value
      }
    }

    const preserveAttrs = ((newNode as HTMLElement).getAttribute(aliasedPreserveAttr) ?? "").split(
      " ",
    )

    for (const { name, value } of newElt.attributes) {
      if (oldElt.getAttribute(name) !== value && !preserveAttrs.includes(name)) {
        oldElt.setAttribute(name, value)
      }
    }

    for (let i = oldElt.attributes.length - 1; i >= 0; i--) {
      const { name } = oldElt.attributes[i]!
      if (!newElt.hasAttribute(name) && !preserveAttrs.includes(name)) {
        oldElt.removeAttribute(name)
      }
    }

    if (shouldScopeChildren && !oldElt.hasAttribute("data-scope-children")) {
      oldElt.setAttribute("data-scope-children", "")
    }

    if (!oldElt.isEqualNode(newElt)) {
      morphChildren(oldElt, newElt)
    }

    if (shouldScopeChildren) {
      oldElt.dispatchEvent(new CustomEvent("datastar:scope-children", { bubbles: false }))
    }
  }

  if (type === 8 || type === 3) {
    if (oldNode.nodeValue !== newNode.nodeValue) {
      oldNode.nodeValue = newNode.nodeValue
    }
  }

  return oldNode
}

const populateIdMapWithTree = (
  root: Element | ShadowRoot | null,
  elements: Iterable<Element>,
): void => {
  for (const elt of elements) {
    if (ctxPersistentIds.has(elt.id)) {
      let current: Element | null = elt
      while (current && current !== root) {
        let idSet = ctxIdMap.get(current)
        if (!idSet) {
          idSet = new Set()
          ctxIdMap.set(current, idSet)
        }
        idSet.add(elt.id)
        current = current.parentElement
      }
    }
  }
}
