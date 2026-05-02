/**
 * Lightweight HTML scanner for finding and rewriting, intended to find assets
 * in code rendered by the routes.
 *
 * Handles most common, modern HTML5 without foreign content (mathml, svg),
 * templates, and possibly many more.
 */
const TEXT = 0
const TAG_OPEN = 1
const TAG_NAME = 2
const BEFORE_ATTR_NAME = 3
const ATTR_NAME = 4
const AFTER_ATTR_NAME = 5
const BEFORE_ATTR_VALUE = 6
const ATTR_VALUE_DOUBLE_QUOTED = 7
const ATTR_VALUE_SINGLE_QUOTED = 8
const ATTR_VALUE_UNQUOTED = 9
const SELF_CLOSING = 10
const BOGUS_COMMENT = 11

const RAW_TEXT_TAGS = ["script", "style", "textarea", "title"]

interface Span {
  start: number
  end: number
}

interface AttrInternal {
  value: string
  nameSpan: Span
  valueSpan: Span | undefined
}

interface TokenizedElement {
  tag: string
  attrs: Map<string, AttrInternal>
  end: number
}

function* tokenize(html: string): Generator<TokenizedElement> {
  const len = html.length
  let i = 0
  let state = TEXT
  let tag = ""
  let attrName = ""
  let attrNameStart = 0
  let attrValue = ""
  let attrValueStart = 0
  let attrs = new Map<string, AttrInternal>()

  let pending: TokenizedElement | undefined

  const emit = (): string | undefined => {
    const lower = tag.toLowerCase()
    pending = { tag, attrs, end: i }
    tag = ""
    attrs = new Map()
    return RAW_TEXT_TAGS.includes(lower) ? lower : undefined
  }

  const emitAndContinue = () => {
    const rawTag = emit()
    state = TEXT
    if (rawTag) {
      const lowerHtml = html.toLowerCase()
      const needle = `</${rawTag}`
      let idx = i
      while (true) {
        idx = lowerHtml.indexOf(needle, idx)
        if (idx === -1) {
          break
        }

        const next = lowerHtml[idx + needle.length]
        if (
          next === undefined ||
          next === ">" ||
          next === "/" ||
          next === " " ||
          next === "\t" ||
          next === "\n" ||
          next === "\r" ||
          next === "\f"
        ) {
          break
        }

        idx += needle.length
      }
      if (idx === -1) {
        i = len
      } else {
        const end = html.indexOf(">", idx + needle.length)
        i = end === -1 ? len : end + 1
      }
    }
  }

  const commitAttr = () => {
    if (attrName) {
      attrs.set(attrName.toLowerCase(), {
        value: attrValue,
        nameSpan: { start: attrNameStart, end: attrNameStart + attrName.length },
        valueSpan:
          attrValueStart > 0
            ? { start: attrValueStart, end: attrValueStart + attrValue.length }
            : undefined,
      })
      attrName = ""
      attrValue = ""
      attrValueStart = 0
    }
  }

  while (i < len) {
    const ch = html[i]

    switch (state) {
      case TEXT:
        if (ch === "<") {
          const next = html[i + 1]
          if (next === "!" && html[i + 2] === "-" && html[i + 3] === "-") {
            const end = html.indexOf("-->", i + 4)
            i = end === -1 ? len : end + 3
          } else if (next === "!" || next === "?") {
            state = BOGUS_COMMENT
            i++
          } else {
            state = TAG_OPEN
            i++
          }
        } else {
          i++
        }
        break

      case BOGUS_COMMENT: {
        const end = html.indexOf(">", i)
        i = end === -1 ? len : end + 1
        state = TEXT
        break
      }

      case TAG_OPEN:
        if (ch === "/") {
          const end = html.indexOf(">", i)
          i = end === -1 ? len : end + 1
          state = TEXT
        } else if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {
          tag = ch
          state = TAG_NAME
          i++
        } else {
          state = TEXT
        }
        break

      case TAG_NAME:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          state = BEFORE_ATTR_NAME
          i++
        } else if (ch === "/") {
          state = SELF_CLOSING
          i++
        } else if (ch === ">") {
          i++
          emitAndContinue()
        } else {
          tag += ch
          i++
        }
        break

      case BEFORE_ATTR_NAME:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          i++
        } else if (ch === "/") {
          state = SELF_CLOSING
          i++
        } else if (ch === ">") {
          i++
          emitAndContinue()
        } else {
          attrName = ch
          attrNameStart = i
          state = ATTR_NAME
          i++
        }
        break

      case ATTR_NAME:
        if (ch === "=") {
          state = BEFORE_ATTR_VALUE
          i++
        } else if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          state = AFTER_ATTR_NAME
          i++
        } else if (ch === "/" || ch === ">") {
          commitAttr()
          if (ch === "/") {
            state = SELF_CLOSING
            i++
          } else {
            i++
            emitAndContinue()
          }
        } else {
          attrName += ch
          i++
        }
        break

      case AFTER_ATTR_NAME:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          i++
        } else if (ch === "=") {
          state = BEFORE_ATTR_VALUE
          i++
        } else if (ch === "/") {
          commitAttr()
          state = SELF_CLOSING
          i++
        } else if (ch === ">") {
          commitAttr()
          i++
          emitAndContinue()
        } else {
          commitAttr()
          attrName = ch
          attrNameStart = i
          state = ATTR_NAME
          i++
        }
        break

      case BEFORE_ATTR_VALUE:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          i++
        } else if (ch === '"') {
          attrValueStart = i + 1
          state = ATTR_VALUE_DOUBLE_QUOTED
          i++
        } else if (ch === "'") {
          attrValueStart = i + 1
          state = ATTR_VALUE_SINGLE_QUOTED
          i++
        } else if (ch === ">") {
          commitAttr()
          i++
          emitAndContinue()
        } else {
          attrValue = ch
          attrValueStart = i
          state = ATTR_VALUE_UNQUOTED
          i++
        }
        break

      case ATTR_VALUE_DOUBLE_QUOTED:
        if (ch === '"') {
          commitAttr()
          state = BEFORE_ATTR_NAME
          i++
        } else {
          attrValue += ch
          i++
        }
        break

      case ATTR_VALUE_SINGLE_QUOTED:
        if (ch === "'") {
          commitAttr()
          state = BEFORE_ATTR_NAME
          i++
        } else {
          attrValue += ch
          i++
        }
        break

      case ATTR_VALUE_UNQUOTED:
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
          commitAttr()
          state = BEFORE_ATTR_NAME
          i++
        } else if (ch === ">") {
          commitAttr()
          i++
          emitAndContinue()
        } else {
          attrValue += ch
          i++
        }
        break

      case SELF_CLOSING:
        if (ch === ">") {
          i++
          emitAndContinue()
        } else {
          state = BEFORE_ATTR_NAME
        }
        break
    }

    if (pending) {
      yield pending
      pending = undefined
    }
  }
}

interface ParsedElement {
  readonly tagName: string
  readonly attributes: ReadonlyMap<string, string>
}

export function* parse(html: string): Generator<ParsedElement> {
  for (const tok of tokenize(html)) {
    const attributes = new Map<string, string>()
    for (const [name, attr] of tok.attrs) {
      attributes.set(name, attr.value)
    }
    yield { tagName: tok.tag.toLowerCase(), attributes }
  }
}

class MutableElement {
  readonly tagName: string
  private _attrs: Map<string, AttrInternal>
  private _edits: Array<{ offset: number; deleteCount: number; insert: string }>
  private _html: string
  private _end: number

  constructor(
    tok: TokenizedElement,
    edits: Array<{ offset: number; deleteCount: number; insert: string }>,
    html: string,
  ) {
    this.tagName = tok.tag.toLowerCase()
    this._attrs = tok.attrs
    this._edits = edits
    this._html = html
    this._end = tok.end
  }

  getAttribute(name: string): string | null {
    const attr = this._attrs.get(name.toLowerCase())
    return attr ? attr.value : null
  }

  hasAttribute(name: string): boolean {
    return this._attrs.has(name.toLowerCase())
  }

  setAttribute(name: string, value: string): this {
    const lower = name.toLowerCase()
    const attr = this._attrs.get(lower)
    if (attr && attr.valueSpan) {
      this._edits.push({
        offset: attr.valueSpan.start,
        deleteCount: attr.valueSpan.end - attr.valueSpan.start,
        insert: value,
      })
      attr.value = value
    } else if (attr) {
      this._edits.push({
        offset: attr.nameSpan.start,
        deleteCount: attr.nameSpan.end - attr.nameSpan.start,
        insert: `${name}="${value}"`,
      })
      attr.value = value
      attr.valueSpan = { start: -1, end: -1 }
    } else {
      const insertAt = this._end - 1
      this._edits.push({
        offset: insertAt,
        deleteCount: 0,
        insert: ` ${name}="${value}"`,
      })
      this._attrs.set(lower, {
        value,
        nameSpan: { start: -1, end: -1 },
        valueSpan: { start: -1, end: -1 },
      })
    }
    return this
  }

  removeAttribute(name: string): this {
    const lower = name.toLowerCase()
    const attr = this._attrs.get(lower)
    if (!attr || attr.nameSpan.start === -1) return this

    let start = attr.nameSpan.start
    const end = attr.valueSpan ? attr.valueSpan.end + 1 : attr.nameSpan.end

    while (start > 0 && " \t\n\r\f".includes(this._html[start - 1])) {
      start--
    }

    this._edits.push({ offset: start, deleteCount: end - start, insert: "" })
    this._attrs.delete(lower)
    return this
  }

  get attributes(): IterableIterator<[string, string]> {
    const entries = this._attrs.entries()
    return (function* () {
      for (const [name, attr] of entries) {
        yield [name, attr.value] as [string, string]
      }
    })()
  }
}

interface RewriteResult extends Iterable<MutableElement> {
  toString(): string
}

export const rewrite = (html: string): RewriteResult => {
  const edits: Array<{ offset: number; deleteCount: number; insert: string }> = []

  return {
    *[Symbol.iterator]() {
      for (const tok of tokenize(html)) {
        yield new MutableElement(tok, edits, html)
      }
    },
    toString() {
      if (edits.length === 0) return html

      edits.sort((a, b) => b.offset - a.offset)
      let result = html
      for (const edit of edits) {
        result =
          result.slice(0, edit.offset) + edit.insert + result.slice(edit.offset + edit.deleteCount)
      }
      return result
    },
  }
}
