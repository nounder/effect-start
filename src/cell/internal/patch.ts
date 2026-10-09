import type * as Cell from "../Cell.ts"
import * as Dom from "../Dom.ts"

export const patchElements = (document: Document, html: string) => {
  const documentMarkup = html.replace(/<svg(\s[^>]*>|>)[\s\S]*?<\/svg>/gi, "")
  const hasHtml = /<\/html\s*>/i.test(documentMarkup)
  const hasHead = /<\/head\s*>/i.test(documentMarkup)
  const hasBody = /<\/body\s*>/i.test(documentMarkup)
  let content = document.createDocumentFragment()
  if (hasHtml || hasHead || hasBody) {
    const parsed = new document.defaultView!.DOMParser().parseFromString(html, "text/html")
    if (hasHtml) content.append(document.importNode(parsed.documentElement, true))
    else {
      if (hasHead) content.append(document.importNode(parsed.head, true))
      if (hasBody) content.append(document.importNode(parsed.body, true))
    }
  } else {
    const template = document.createElement("template")
    template.innerHTML = html
    content = template.content
  }

  for (const element of Array.from(content.children)) {
    const source = element.getAttribute("data-cell")
    const value = source === null
      ? {}
      : document.defaultView!.Function(`"use strict"; return (${source}\n)`)() as
        | Cell.CellFunction
        | Cell.CellDeclaration
    const declaration = typeof value === "function" ? {} : value
    const operation = (["append", "prepend", "before", "after", "replace", "morph", "morphChildren"] as const)
      .find((key) => declaration[key] !== undefined)
    if (operation) {
      const target = document.querySelector(declaration[operation]!)!
      if (operation === "morph") Dom.morph(target, element)
      else if (operation === "morphChildren") {
        const children = document.createDocumentFragment()
        children.append(...element.childNodes)
        Dom.morph(target, children, "inner")
        if (declaration.setup !== undefined) target.setAttribute("data-cell", source!)
      } else if (operation === "replace") target.replaceWith(element)
      else target[operation](element)
    } else {
      const target = element.localName === "html" ?
        document.documentElement
        : element.localName === "head" ?
        document.head
        : element.localName === "body" ?
        document.body
        : element.id && document.getElementById(element.id)
      if (target) Dom.morph(target, element)
    }
  }
}
