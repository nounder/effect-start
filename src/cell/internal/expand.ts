import type { Signals } from "./signals.ts"

export interface Scope {
  item: any
  index: number
}

interface Row {
  start: Comment
  end: Comment
  scope: Scope | undefined
  nodes: Array<ChildNode>
}

export const createExpansion = (
  template: HTMLTemplateElement,
  source: unknown,
  inheritedScope: Scope | undefined,
  signals: Signals,
  scopes: WeakMap<Node, Scope>,
  disposeTree: (node: Node) => void,
  onError: (error: unknown) => void,
) => {
  const document = template.ownerDocument
  const end = document.createComment("cell:expand")
  const rows: Array<Row> = []
  let items: Array<unknown> = []
  let array = false
  let stopped = false
  let blueprint = template.innerHTML

  const range = (row: Row) => {
    if (row.start.parentNode && row.start.parentNode === row.end.parentNode) {
      const nodes: Array<ChildNode> = []
      for (let node: ChildNode | null = row.start; node; node = node.nextSibling) {
        nodes.push(node)
        if (node === row.end) return nodes
      }
    }
    return null
  }

  const remove = (row: Row) => {
    // Keep the original nodes as a fallback when a server patch removes a boundary.
    const nodes = new Set([...(range(row) ?? []), ...row.nodes])
    for (const node of nodes) disposeTree(node)
    for (const node of nodes) node.remove()
  }

  const clear = () => {
    for (const row of rows.splice(0)) remove(row)
  }

  const refresh = () => {
    if (stopped || !template.parentNode) return
    for (const row of rows) {
      const nodes = range(row)
      if (!nodes || row.nodes.some((node) => !nodes.includes(node))) {
        clear()
        break
      }
    }
    if (end.parentNode !== template.parentNode) template.after(end)
    while (rows.length > items.length) remove(rows.pop()!)
    for (let index = 0; index < items.length; index++) {
      if (rows[index]) {
        if (array) rows[index].scope!.item = items[index]
        continue
      }
      const scope = array ? signals.reactive({ item: items[index], index }) : inheritedScope
      const content = document.importNode(template.content, true)
      for (const node of content.childNodes) {
        if (scope) scopes.set(node, scope)
      }
      const start = document.createComment("cell:row")
      const finish = document.createComment("/cell:row")
      content.prepend(start)
      content.append(finish)
      const row = { start, end: finish, scope, nodes: Array.from(content.childNodes) }
      rows.push(row)
      end.before(content)
    }

    let previous: ChildNode = template
    for (const row of rows) {
      if (previous.nextSibling !== row.start) {
        const parent = template.parentNode
        const before = previous.nextSibling
        for (const node of range(row)!) {
          if ("moveBefore" in parent && parent.isConnected === node.isConnected) parent.moveBefore(node, before)
          else parent.insertBefore(node, before)
        }
      }
      previous = row.end
    }
    if (previous.nextSibling !== end) previous.after(end)
  }

  const stopEffect = signals.effect(() => {
    const value = typeof source === "function" ? source() : source
    const nextArray = Array.isArray(value)
    const nextItems = nextArray ? Array.from(value) : value ? [undefined] : []
    signals.untrack(() => {
      if (array !== nextArray) clear()
      array = nextArray
      items = nextItems
      refresh()
    })
  }, onError)

  const observer = new document.defaultView!.MutationObserver(() => {
    if (stopped || blueprint === template.innerHTML) return
    blueprint = template.innerHTML
    try {
      signals.untrack(() => {
        clear()
        refresh()
      })
    } catch (error) {
      onError(error)
    }
  })
  observer.observe(template.content, { subtree: true, childList: true, attributes: true, characterData: true })

  return {
    refresh,
    stop() {
      if (stopped) return
      stopped = true
      observer.disconnect()
      stopEffect()
      clear()
      end.remove()
    },
  }
}
