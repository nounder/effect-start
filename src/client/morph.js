/**
 * DOM morphing from Datastar of Star Federation.
 */

/**
 * @param {Node} el
 * @returns {el is HTMLElement | SVGElement | MathMLElement}
 */
const isHTMLOrSVG = (el) =>
  el instanceof HTMLElement || el instanceof SVGElement || el instanceof MathMLElement

const PROP_CHANGE_EVENT = "datastar-prop-change"
const SCOPE_CHILDREN_EVENT = "datastar-scope-children"
const IGNORE_MORPH_ATTR = "data-ignore-morph"
const IGNORE_MORPH_SELECTOR = `[${IGNORE_MORPH_ATTR}]`
const PRESERVE_ATTR = "data-preserve-attr"

const ctxIdMap = new Map()
const ctxPersistentIds = new Set()
const oldIdTagNameMap = new Map()
const duplicateIds = new Set()
const ctxPantry = document.createElement("div")
ctxPantry.hidden = true

/**
 * @param {Element | ShadowRoot} oldElt
 * @param {DocumentFragment | Element} newContent
 * @param {"outer" | "inner"} [mode]
 */
export const morph = (oldElt, newContent, mode = "outer") => {
  if (
    (isHTMLOrSVG(oldElt) &&
      isHTMLOrSVG(newContent) &&
      oldElt.hasAttribute(IGNORE_MORPH_ATTR) &&
      newContent.hasAttribute(IGNORE_MORPH_ATTR)) ||
    oldElt.parentElement?.closest(IGNORE_MORPH_SELECTOR)
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

  const parent = mode === "outer" ? oldElt.parentElement : oldElt
  populateIdMapWithTree(parent, oldIdElements)
  populateIdMapWithTree(normalizedElt, newIdElements)

  morphChildren(parent, normalizedElt, mode === "outer" ? oldElt : null, oldElt.nextSibling)

  ctxPantry.remove()
}

/**
 * @param {Element | ShadowRoot} oldParent
 * @param {Element} newParent
 * @param {Node | null} [insertionPoint]
 * @param {Node | null} [endPoint]
 */
const morphChildren = (oldParent, newParent, insertionPoint = null, endPoint = null) => {
  if (oldParent instanceof HTMLTemplateElement && newParent instanceof HTMLTemplateElement) {
    oldParent = oldParent.content
    newParent = newParent.content
  }
  insertionPoint ??= oldParent.firstChild

  for (const newChild of newParent.childNodes) {
    if (insertionPoint && insertionPoint !== endPoint) {
      const bestMatch = findBestMatch(newChild, insertionPoint, endPoint)
      if (bestMatch) {
        if (bestMatch !== insertionPoint) {
          let cursor = insertionPoint
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
      const movedChild = document.getElementById(newChild.id)

      let current = movedChild
      while ((current = current.parentNode)) {
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
      const namespaceURI = newChild.namespaceURI
      const tagName = newChild.tagName
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

/**
 * @param {Node} node
 * @param {Node | null} startPoint
 * @param {Node | null} endPoint
 * @returns {Node | null}
 */
const findBestMatch = (node, startPoint, endPoint) => {
  let bestMatch = null
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

/**
 * @param {Node} oldNode
 * @param {Node} newNode
 * @returns {boolean}
 */
const isSoftMatch = (oldNode, newNode) =>
  oldNode.nodeType === newNode.nodeType &&
  oldNode.tagName === newNode.tagName &&
  (!oldNode.id || oldNode.id === newNode.id)

/**
 * @param {Node} node
 */
const removeNode = (node) => {
  ctxIdMap.has(node) ? moveBefore(ctxPantry, node, null) : node.parentNode?.removeChild(node)
}

/**
 * @param {Node} parentNode
 * @param {Node} node
 * @param {Node | null} after
 */
const moveBefore = (parentNode, node, after) => {
  if ("moveBefore" in parentNode) {
    parentNode.moveBefore(node, after)
    return
  }
  parentNode.insertBefore(node, after)
}

/**
 * @param {Node} oldNode
 * @param {Node} newNode
 * @returns {Node}
 */
const morphNode = (oldNode, newNode) => {
  const type = newNode.nodeType

  if (type === 1) {
    const oldElt = oldNode
    const newElt = newNode
    const shouldScopeChildren = oldElt.hasAttribute("data-scope-children")
    if (oldElt.hasAttribute(IGNORE_MORPH_ATTR) && newElt.hasAttribute(IGNORE_MORPH_ATTR)) {
      return oldNode
    }

    const preserveAttrs = (newNode.getAttribute(PRESERVE_ATTR) ?? "").split(" ")

    /**
     * @param {Element} oldElt
     * @param {Element} newElt
     * @param {string} name
     * @returns {boolean}
     */
    const updateElementProp = (oldElt, newElt, name) => {
      const newEltHasAttr = newElt.hasAttribute(name)
      if (oldElt.hasAttribute(name) !== newEltHasAttr && !preserveAttrs.includes(name)) {
        oldElt[name] = newEltHasAttr
        return true
      }
      return false
    }

    let shouldDispatchPropChangeEvent = false
    if (
      oldElt instanceof HTMLInputElement &&
      newElt instanceof HTMLInputElement &&
      newElt.type !== "file"
    ) {
      const newValue = newElt.getAttribute("value")
      if (oldElt.getAttribute("value") !== newValue && !preserveAttrs.includes("value")) {
        oldElt.value = newValue ?? ""
        shouldDispatchPropChangeEvent = true
      }
      shouldDispatchPropChangeEvent =
        updateElementProp(oldElt, newElt, "checked") || shouldDispatchPropChangeEvent
      updateElementProp(oldElt, newElt, "disabled")
    } else if (oldElt instanceof HTMLTextAreaElement && newElt instanceof HTMLTextAreaElement) {
      const newValue = newElt.value
      if (oldElt.defaultValue !== newValue) {
        oldElt.value = newValue
        shouldDispatchPropChangeEvent = true
      }
    } else if (oldElt instanceof HTMLOptionElement && newElt instanceof HTMLOptionElement) {
      shouldDispatchPropChangeEvent =
        updateElementProp(oldElt, newElt, "selected") || shouldDispatchPropChangeEvent
    }

    for (const { name, value } of newElt.attributes) {
      if (oldElt.getAttribute(name) !== value && !preserveAttrs.includes(name)) {
        oldElt.setAttribute(name, value)
      }
    }

    for (const { name } of Array.from(oldElt.attributes)) {
      if (!newElt.hasAttribute(name) && !preserveAttrs.includes(name)) {
        oldElt.removeAttribute(name)
      }
    }

    if (shouldDispatchPropChangeEvent) {
      const dispatchElt = oldElt instanceof HTMLOptionElement ? oldElt.closest("select") : oldElt
      dispatchElt?.dispatchEvent(new Event(PROP_CHANGE_EVENT, { bubbles: true }))
    }

    if (shouldScopeChildren && !oldElt.hasAttribute("data-scope-children")) {
      oldElt.setAttribute("data-scope-children", "")
    }

    if (oldElt instanceof HTMLTemplateElement && newElt instanceof HTMLTemplateElement) {
      oldElt.innerHTML = newElt.innerHTML
    } else if (!oldElt.isEqualNode(newElt)) {
      morphChildren(oldElt, newElt)
    }

    if (shouldScopeChildren) {
      oldElt.dispatchEvent(new CustomEvent(SCOPE_CHILDREN_EVENT, { bubbles: false }))
    }
  }

  if (type === 8 || type === 3) {
    if (oldNode.nodeValue !== newNode.nodeValue) {
      oldNode.nodeValue = newNode.nodeValue
    }
  }

  return oldNode
}

/**
 * @param {Element | ShadowRoot | null} root
 * @param {Iterable<Element>} elements
 */
const populateIdMapWithTree = (root, elements) => {
  for (const elt of elements) {
    if (ctxPersistentIds.has(elt.id)) {
      let current = elt
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
