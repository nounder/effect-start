import { morph } from "../morph.js"

export const patchElements = (document, html, options = {}) => {
  const mode = options.mode ?? "outer"
  if (!["outer", "inner", "replace", "remove", "prepend", "append", "before", "after"].includes(mode)) {
    throw new TypeError(`Unsupported patch mode: ${mode}`)
  }
  if (!options.selector && mode !== "outer" && mode !== "replace") {
    throw new TypeError(`${mode} requires a selector`)
  }
  const template = document.createElement("template")
  const namespace = options.namespace ?? "html"
  if (!["html", "svg", "mathml"].includes(namespace)) throw new TypeError(`Unsupported namespace: ${namespace}`)
  const wrapper = namespace === "svg" ? "svg" : namespace === "mathml" ? "math" : ""
  const documentMarkup = html.replace(/<svg(\s[^>]*>|>)[\s\S]*?<\/svg>/gi, "")
  const hasHtml = /<\/html\s*>/i.test(documentMarkup)
  const hasHead = /<\/head\s*>/i.test(documentMarkup)
  const hasBody = /<\/body\s*>/i.test(documentMarkup)
  let content = document.createDocumentFragment()
  if (hasHtml || hasHead || hasBody) {
    const parsed = new document.defaultView.DOMParser().parseFromString(html, "text/html")
    if (hasHtml) content.append(document.importNode(parsed.documentElement, true))
    else {
      if (hasHead) content.append(document.importNode(parsed.head, true))
      if (hasBody) content.append(document.importNode(parsed.body, true))
    }
  } else {
    template.innerHTML = wrapper ? `<${wrapper}>${html}</${wrapper}>` : html
    content = template.content
    if (wrapper) {
      const fragment = document.createDocumentFragment()
      fragment.append(...content.firstElementChild.childNodes)
      content = fragment
    }
  }

  const apply = (target, content) => {
    const next = content.cloneNode(true)
    if (mode === "outer" || mode === "inner") morph(target, next, mode)
    else if (mode === "replace") target.replaceWith(next)
    else if (mode === "remove") target.remove()
    else target[mode](next)
  }

  if (options.selector) {
    for (const target of document.querySelectorAll(options.selector)) apply(target, content)
  } else {
    for (const element of content.children) {
      const target = element.localName === "html" ?
        document.documentElement
        : element.localName === "head" ?
        document.head
        : element.localName === "body" ?
        document.body
        : element.id && document.getElementById(element.id)
      if (target) apply(target, element)
    }
  }
}
