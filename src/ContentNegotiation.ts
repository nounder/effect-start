/**
 * RFC 7231 Content Negotiation compatible with Express/Node.js ecosystem.
 * Based on {@link https://github.com/jshttp/negotiator}
 */

import type * as Headers from "@effect/platform/Headers"

interface ParsedSpec {
  value: string
  q: number
  s: number
  o: number
  i: number
}

const simpleMediaTypeRegExp = /^\s*([^\s\/;]+)\/([^;\s]+)\s*(?:;(.*))?$/
const simpleLanguageRegExp = /^\s*([^\s\-;]+)(?:-([^\s;]+))?\s*(?:;(.*))?$/
const simpleEncodingRegExp = /^\s*([^\s;]+)\s*(?:;(.*))?$/
const simpleCharsetRegExp = /^\s*([^\s;]+)\s*(?:;(.*))?$/

function parseQuality(params: string | undefined): number {
  if (!params) return 1
  const match = params.match(/q\s*=\s*([0-9.]+)/)
  if (!match) return 1
  const q = parseFloat(match[1])
  return isNaN(q) ? 1 : Math.min(Math.max(q, 0), 1)
}

function splitMediaTypeParams(
  params: string,
): { params: Record<string, string>; q: number } {
  const result: Record<string, string> = {}
  let q = 1

  const parts = params.split(";")
  for (const part of parts) {
    const trimmed = part.trim()
    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim().toLowerCase()
    let value = trimmed.slice(eqIndex + 1).trim()

    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1)
    }

    if (key === "q") {
      q = parseFloat(value)
      if (isNaN(q)) q = 1
      q = Math.min(Math.max(q, 0), 1)
    } else {
      result[key] = value
    }
  }

  return { params: result, q }
}

function parseAccept(
  accept: string,
): Array<
  {
    type: string
    subtype: string
    params: Record<string, string>
    q: number
    o: number
  }
> {
  const specs: Array<{
    type: string
    subtype: string
    params: Record<string, string>
    q: number
    o: number
  }> = []
  const parts = accept.split(",")

  for (let o = 0; o < parts.length; o++) {
    const part = parts[o].trim()
    if (!part) continue

    const match = simpleMediaTypeRegExp.exec(part)
    if (!match) continue

    const type = match[1].toLowerCase()
    const subtype = match[2].toLowerCase()
    const { params, q } = match[3]
      ? splitMediaTypeParams(match[3])
      : { params: {}, q: 1 }

    if (q > 0) {
      specs.push({ type, subtype, params, q, o })
    }
  }

  return specs
}

function specifyMediaType(
  type: string,
  subtype: string,
  params: Record<string, string>,
  spec: {
    type: string
    subtype: string
    params: Record<string, string>
    q: number
    o: number
  },
): { q: number; s: number; o: number } | null {
  let s = 0

  if (spec.type === type) {
    s |= 4 // exact match: highest specificity
  } else if (type === "*") {
    s |= 0 // server offers wildcard (e.g. */*): matches any client type
  } else if (spec.type !== "*") {
    // client is NOT requesting wildcard: no match
    return null
  }

  // client requests wildcard (e.g. Accept: */*)
  if (spec.subtype === subtype) {
    s |= 2 // // exact match: highest specificity
  } else if (subtype === "*") {
    s |= 1 // server offers wildcard (e.g. text/*)
  } else if (spec.subtype !== "*") {
    return null // client is NOT requesting wildcard
  }

  // client requests wildcard (e.g. Accept: text/*): matches any server subtype
  const specParams = Object.keys(spec.params)
  if (specParams.length > 0) {
    if (
      specParams.every(
        (key) =>
          spec.params[key].toLowerCase() === (params[key] || "").toLowerCase(),
      )
    ) {
      s |= 1
    } else {
      return null
    }
  }

  return { q: spec.q, s, o: spec.o }
}

function getMediaTypePriority(
  mediaType: string,
  accepted: Array<
    {
      type: string
      subtype: string
      params: Record<string, string>
      q: number
      o: number
    }
  >,
  index: number,
): ParsedSpec {
  let best: { q: number; s: number; o: number } | null = null

  const match = simpleMediaTypeRegExp.exec(mediaType)
  if (!match) {
    return { value: mediaType, q: 0, s: 0, o: -1, i: index }
  }

  const type = match[1].toLowerCase()
  const subtype = match[2].toLowerCase()
  const { params } = match[3]
    ? splitMediaTypeParams(match[3])
    : { params: {} }

  for (const spec of accepted) {
    const result = specifyMediaType(type, subtype, params, spec)
    if (
      result
      && (best === null
        || result.s > best.s
        || (result.s === best.s && result.q > best.q)
        || (result.s === best.s && result.q === best.q && result.o < best.o))
    ) {
      best = result
    }
  }

  return {
    value: mediaType,
    q: best?.q ?? 0,
    s: best?.s ?? 0,
    o: best?.o ?? -1,
    i: index,
  }
}

function parseAcceptLanguage(
  accept: string,
): Array<{ prefix: string; suffix: string | undefined; q: number; o: number }> {
  const specs: Array<{
    prefix: string
    suffix: string | undefined
    q: number
    o: number
  }> = []
  const parts = accept.split(",")

  for (let o = 0; o < parts.length; o++) {
    const part = parts[o].trim()
    if (!part) continue

    const match = simpleLanguageRegExp.exec(part)
    if (!match) continue

    const prefix = match[1].toLowerCase()
    const suffix = match[2]?.toLowerCase()
    const q = parseQuality(match[3])

    if (q > 0) {
      specs.push({ prefix, suffix, q, o })
    }
  }

  return specs
}

function specifyLanguage(
  language: string,
  spec: { prefix: string; suffix: string | undefined; q: number; o: number },
): { q: number; s: number; o: number } | null {
  const match = simpleLanguageRegExp.exec(language)
  if (!match) return null

  const prefix = match[1].toLowerCase()
  const suffix = match[2]?.toLowerCase()

  if (spec.prefix === "*") {
    return { q: spec.q, s: 0, o: spec.o }
  }

  if (spec.prefix !== prefix) {
    return null
  }

  if (spec.suffix === undefined) {
    return { q: spec.q, s: suffix ? 2 : 4, o: spec.o }
  }

  if (spec.suffix === suffix) {
    return { q: spec.q, s: 4, o: spec.o }
  }

  return null
}

function getLanguagePriority(
  language: string,
  accepted: Array<
    { prefix: string; suffix: string | undefined; q: number; o: number }
  >,
  index: number,
): ParsedSpec {
  let best: { q: number; s: number; o: number } | null = null

  for (const spec of accepted) {
    const result = specifyLanguage(language, spec)
    if (
      result
      && (best === null
        || result.s > best.s
        || (result.s === best.s && result.q > best.q)
        || (result.s === best.s && result.q === best.q && result.o < best.o))
    ) {
      best = result
    }
  }

  return {
    value: language,
    q: best?.q ?? 0,
    s: best?.s ?? 0,
    o: best?.o ?? -1,
    i: index,
  }
}

function parseAcceptEncoding(
  accept: string,
): Array<{ encoding: string; q: number; o: number }> {
  const specs: Array<{ encoding: string; q: number; o: number }> = []
  const parts = accept.split(",")
  let hasIdentity = false

  for (let o = 0; o < parts.length; o++) {
    const part = parts[o].trim()
    if (!part) continue

    const match = simpleEncodingRegExp.exec(part)
    if (!match) continue

    const encoding = match[1].toLowerCase()
    const q = parseQuality(match[2])

    if (encoding === "identity") hasIdentity = true
    if (encoding === "*") hasIdentity = true

    if (q > 0) {
      specs.push({ encoding, q, o })
    }
  }

  if (!hasIdentity) {
    specs.push({ encoding: "identity", q: 0.0001, o: specs.length })
  }

  return specs
}

function specifyEncoding(
  encoding: string,
  spec: { encoding: string; q: number; o: number },
): { q: number; s: number; o: number } | null {
  const e = encoding.toLowerCase()
  const s = spec.encoding

  if (s === "*" || s === e) {
    return { q: spec.q, s: s === e ? 1 : 0, o: spec.o }
  }

  return null
}

function getEncodingPriority(
  encoding: string,
  accepted: Array<{ encoding: string; q: number; o: number }>,
  index: number,
): ParsedSpec {
  let best: { q: number; s: number; o: number } | null = null

  for (const spec of accepted) {
    const result = specifyEncoding(encoding, spec)
    if (
      result
      && (best === null
        || result.s > best.s
        || (result.s === best.s && result.q > best.q)
        || (result.s === best.s && result.q === best.q && result.o < best.o))
    ) {
      best = result
    }
  }

  return {
    value: encoding,
    q: best?.q ?? 0,
    s: best?.s ?? 0,
    o: best?.o ?? -1,
    i: index,
  }
}

function parseAcceptCharset(
  accept: string,
): Array<{ charset: string; q: number; o: number }> {
  const specs: Array<{ charset: string; q: number; o: number }> = []
  const parts = accept.split(",")

  for (let o = 0; o < parts.length; o++) {
    const part = parts[o].trim()
    if (!part) continue

    const match = simpleCharsetRegExp.exec(part)
    if (!match) continue

    const charset = match[1].toLowerCase()
    const q = parseQuality(match[2])

    if (q > 0) {
      specs.push({ charset, q, o })
    }
  }

  return specs
}

function specifyCharset(
  charset: string,
  spec: { charset: string; q: number; o: number },
): { q: number; s: number; o: number } | null {
  const c = charset.toLowerCase()
  const s = spec.charset

  if (s === "*" || s === c) {
    return { q: spec.q, s: s === c ? 1 : 0, o: spec.o }
  }

  return null
}

function getCharsetPriority(
  charset: string,
  accepted: Array<{ charset: string; q: number; o: number }>,
  index: number,
): ParsedSpec {
  let best: { q: number; s: number; o: number } | null = null

  for (const spec of accepted) {
    const result = specifyCharset(charset, spec)
    if (
      result
      && (best === null
        || result.s > best.s
        || (result.s === best.s && result.q > best.q)
        || (result.s === best.s && result.q === best.q && result.o < best.o))
    ) {
      best = result
    }
  }

  return {
    value: charset,
    q: best?.q ?? 0,
    s: best?.s ?? 0,
    o: best?.o ?? -1,
    i: index,
  }
}

function compareSpecs(a: ParsedSpec, b: ParsedSpec): number {
  return (
    b.q - a.q
    || b.s - a.s
    || a.o - b.o
    || a.i - b.i
  )
}

export function media(accept: string, available?: string[]): string[] {
  const parsed = parseAccept(accept)
  if (parsed.length === 0) {
    return []
  }

  if (!available) {
    return parsed.sort((a, b) => b.q - a.q || a.o - b.o).map((p) =>
      `${p.type}/${p.subtype}`
    )
  }

  const priorities = available.map((t, i) => getMediaTypePriority(t, parsed, i))
  const sorted = priorities.filter((p) => p.q > 0).sort(compareSpecs)

  return sorted.map((p) => p.value)
}

export function language(accept: string, available?: string[]): string[] {
  const parsed = parseAcceptLanguage(accept)
  if (parsed.length === 0) {
    return []
  }

  if (!available) {
    return parsed.sort((a, b) => b.q - a.q || a.o - b.o).map((p) =>
      p.suffix ? `${p.prefix}-${p.suffix}` : p.prefix
    )
  }

  const priorities = available.map((l, i) => getLanguagePriority(l, parsed, i))
  const sorted = priorities.filter((p) => p.q > 0).sort(compareSpecs)

  return sorted.map((p) => p.value)
}

export function encoding(accept: string, available?: string[]): string[] {
  const parsed = parseAcceptEncoding(accept)
  if (parsed.length === 0) {
    return []
  }

  if (!available) {
    return parsed.sort((a, b) => b.q - a.q || a.o - b.o).map((p) => p.encoding)
  }

  const priorities = available.map((e, i) => getEncodingPriority(e, parsed, i))
  const sorted = priorities.filter((p) => p.q > 0).sort(compareSpecs)

  return sorted.map((p) => p.value)
}

export function charset(accept: string, available?: string[]): string[] {
  const parsed = parseAcceptCharset(accept)
  if (parsed.length === 0) {
    return []
  }

  if (!available) {
    return parsed.sort((a, b) => b.q - a.q || a.o - b.o).map((p) => p.charset)
  }

  const priorities = available.map((c, i) => getCharsetPriority(c, parsed, i))
  const sorted = priorities.filter((p) => p.q > 0).sort(compareSpecs)

  return sorted.map((p) => p.value)
}

export function headerMedia(
  headers: Headers.Headers,
  available?: string[],
): string[] {
  const accept = headers["accept"]
  if (!accept) return []
  return media(accept, available)
}

export function headerLanguage(
  headers: Headers.Headers,
  available?: string[],
): string[] {
  const accept = headers["accept-language"]
  if (!accept) return []
  return language(accept, available)
}

export function headerEncoding(
  headers: Headers.Headers,
  available?: string[],
): string[] {
  const accept = headers["accept-encoding"]
  if (!accept) return []
  return encoding(accept, available)
}

export function headerCharset(
  headers: Headers.Headers,
  available?: string[],
): string[] {
  const accept = headers["accept-charset"]
  if (!accept) return []
  return charset(accept, available)
}
