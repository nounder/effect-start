import { morph } from "../morph.js"

export const patchElements = (document, html, setup) => {
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
    const template = document.createElement("template")
    template.innerHTML = html
    content = template.content
  }

  for (const element of Array.from(content.children)) {
    if (setup && element.hasAttribute("data-cell")) {
      setup(document.adoptNode(element))
    } else {
      const target = element.localName === "html" ?
        document.documentElement
        : element.localName === "head" ?
        document.head
        : element.localName === "body" ?
        document.body
        : element.id && document.getElementById(element.id)
      if (target) morph(target, element)
    }
  }
}
