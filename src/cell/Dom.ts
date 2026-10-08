/**
 * DOM matching and morphing adapted from the bundled Datastar v1.0.1 fork (MIT).
 * Consumes newContent. No attribute handling, script execution, or runtime hooks.
 */
export const morph = (
  oldElt: Element | ShadowRoot,
  newContent: DocumentFragment | Element,
  mode: "outer" | "inner" = "outer",
) => {
  const document = oldElt.ownerDocument
  const window = document.defaultView!
  const ctxIdMap = new Map<Node, Set<string>>()
  const ctxPersistentIds = new Set<string>()
  const persistentElements = new Map<string, Element>()
  const oldIdTagNameMap = new Map<string, string>()
  const duplicateIds = new Set<string>()
  const ctxPantry = document.createElement("div")
  ctxPantry.hidden = true

  const morphChildren = (
    oldParent: ParentNode,
    newParent: Element | DocumentFragment,
    insertionPoint: Node | null = null,
    endPoint: Node | null = null,
  ) => {
    if (
      oldParent instanceof window.HTMLTemplateElement &&
      newParent instanceof window.HTMLTemplateElement
    ) {
      oldParent = oldParent.content
      newParent = newParent.content
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

      if (newChild instanceof window.Element && ctxPersistentIds.has(newChild.id)) {
        const movedChild = persistentElements.get(newChild.id)!

        let current: Node | null = movedChild
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
        const namespaceURI = (newChild as Element).namespaceURI
        const tagName = (newChild as Element).tagName
        const newEmptyChild = namespaceURI && namespaceURI !== "http://www.w3.org/1999/xhtml"
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

  const isSoftMatch = (oldNode: Node, newNode: Node) =>
    oldNode.nodeType === newNode.nodeType &&
    (oldNode as Element).tagName === (newNode as Element).tagName &&
    (!(oldNode as Element).id || (oldNode as Element).id === (newNode as Element).id)

  const removeNode = (node: Node) => {
    ctxIdMap.has(node)
      ? moveBefore(ctxPantry, node, null)
      : node.parentNode?.removeChild(node)
  }

  const moveBefore = (parentNode: ParentNode, node: Node, after: Node | null) => {
    if ("moveBefore" in parentNode && node.parentNode && parentNode.isConnected === node.isConnected) {
      parentNode.moveBefore(node, after)
      return
    }
    parentNode.insertBefore(node, after)
  }

  const morphNode = (oldNode: Node, newNode: Node): Node => {
    const type = newNode.nodeType

    if (type === 1) {
      const oldElt = oldNode as Element
      const newElt = newNode as Element
      const updateElementProp = <K extends string>(oldElt: Element & Record<K, boolean>, newElt: Element, name: K) => {
        const newEltHasAttr = newElt.hasAttribute(name)
        if (
          oldElt.hasAttribute(name) !== newEltHasAttr
        ) {
          ;(oldElt as Record<K, boolean>)[name] = newEltHasAttr
          return true
        }
        return false
      }

      if (
        oldElt instanceof window.HTMLInputElement &&
        newElt instanceof window.HTMLInputElement &&
        newElt.type !== "file"
      ) {
        const newValue = newElt.getAttribute("value")
        if (
          oldElt.getAttribute("value") !== newValue
        ) {
          oldElt.value = newValue ?? ""
        }
        updateElementProp(oldElt, newElt, "checked")
        updateElementProp(oldElt, newElt, "disabled")
      } else if (
        oldElt instanceof window.HTMLTextAreaElement &&
        newElt instanceof window.HTMLTextAreaElement
      ) {
        const newValue = newElt.value
        if (oldElt.defaultValue !== newValue) {
          oldElt.value = newValue
        }
      } else if (
        oldElt instanceof window.HTMLOptionElement && newElt instanceof window.HTMLOptionElement
      ) {
        updateElementProp(oldElt, newElt, "selected")
      }

      for (const attribute of newElt.attributes) {
        const name = attribute.name
        const value = attribute.value
        if (
          oldElt.getAttribute(name) !== value
        ) {
          oldElt.setAttribute(name, value)
        }
      }

      for (const attribute of Array.from(oldElt.attributes)) {
        const name = attribute.name
        if (!newElt.hasAttribute(name)) {
          oldElt.removeAttribute(name)
        }
      }

      if (
        oldElt instanceof window.HTMLTemplateElement &&
        newElt instanceof window.HTMLTemplateElement
      ) {
        oldElt.innerHTML = newElt.innerHTML
      } else if (!oldElt.isEqualNode(newElt)) {
        morphChildren(oldElt, newElt)
      }
    }

    if (type === 8 || type === 3) {
      if (oldNode.nodeValue !== newNode.nodeValue) {
        oldNode.nodeValue = newNode.nodeValue
      }
    }

    return oldNode
  }

  const populateIdMapWithTree = (root: Node | null, elements: Iterable<Element>) => {
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

  const normalizedElt = document.createElement("div")
  normalizedElt.append(newContent)

  const oldIdElements = oldElt.querySelectorAll("[id]")
  for (const element of oldIdElements) {
    const id = element.id
    const tagName = element.tagName
    if (oldIdTagNameMap.has(id)) {
      duplicateIds.add(id)
    } else {
      oldIdTagNameMap.set(id, tagName)
    }
  }
  if (oldElt instanceof window.Element && oldElt.id) {
    if (oldIdTagNameMap.has(oldElt.id)) {
      duplicateIds.add(oldElt.id)
    } else {
      oldIdTagNameMap.set(oldElt.id, oldElt.tagName)
    }
  }

  for (const element of [oldElt, ...oldIdElements]) {
    if ("id" in element && element.id) persistentElements.set(element.id, element)
  }

  ctxPersistentIds.clear()
  const newIdElements = normalizedElt.querySelectorAll("[id]")
  for (const element of newIdElements) {
    const id = element.id
    const tagName = element.tagName
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

  const parent = mode === "outer" ? oldElt.parentNode! : oldElt
  populateIdMapWithTree(parent, oldIdElements)
  populateIdMapWithTree(normalizedElt, newIdElements)

  if (oldElt.isConnected) document.documentElement.append(ctxPantry)
  try {
    morphChildren(
      parent,
      normalizedElt,
      mode === "outer" ? oldElt : null,
      mode === "outer" ? oldElt.nextSibling : null,
    )
  } finally {
    ctxPantry.remove()
  }
}
