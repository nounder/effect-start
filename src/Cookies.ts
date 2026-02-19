/*
 * Minimal Cookies management adapted from @effect/platform
 * We'll aim for full compatbility when it stabilizes.
 */
import * as Duration from "effect/Duration"
import * as Inspectable from "effect/Inspectable"
import * as Option from "effect/Option"
import * as Pipeable from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import type * as Types from "effect/Types"

export const TypeId = "~effect-start/Cookies" as const

export const isCookies = (u: unknown): u is Cookies => Predicate.hasProperty(u, TypeId)

export interface Cookies extends Pipeable.Pipeable, Inspectable.Inspectable {
  readonly [TypeId]: typeof TypeId
  readonly cookies: Record<string, Cookie>
}

export const CookieTypeId = "~effect-start/Cookies/Cookie" as const

export interface Cookie extends Inspectable.Inspectable {
  readonly [CookieTypeId]: typeof CookieTypeId
  readonly name: string
  readonly value: string
  readonly valueEncoded: string
  readonly options?:
    | {
        readonly domain?: string | undefined
        readonly expires?: Date | undefined
        readonly maxAge?: Duration.DurationInput | undefined
        readonly path?: string | undefined
        readonly priority?: "low" | "medium" | "high" | undefined
        readonly httpOnly?: boolean | undefined
        readonly secure?: boolean | undefined
        readonly partitioned?: boolean | undefined
        readonly sameSite?:
          // send with top-level navigations and GET requests from third-party sites
          | "lax"
          // only send with same-site requests
          | "strict"
          // send with all requests (requires Secure)
          | "none"
          | undefined
      }
    | undefined
}

const CookiesProto: Omit<Cookies, "cookies"> = {
  [TypeId]: TypeId,
  ...Inspectable.BaseProto,
  toJSON(this: Cookies) {
    return {
      _id: "effect-start/Cookies",
      cookies: Object.fromEntries(Object.entries(this.cookies).map(([k, v]) => [k, v.toJSON()])),
    }
  },
  pipe() {
    return Pipeable.pipeArguments(this, arguments)
  },
}

const CookieProto = {
  [CookieTypeId]: CookieTypeId,
  ...Inspectable.BaseProto,
  toJSON(this: Cookie) {
    return {
      _id: "effect-start/Cookies/Cookie",
      name: this.name,
      value: this.value,
      options: this.options,
    }
  },
}

const makeCookiesFromRecord = (cookies: Record<string, Cookie>): Cookies => {
  const self = Object.create(CookiesProto)
  self.cookies = cookies
  return self
}

const cookieFromParts = (
  name: string,
  value: string,
  valueEncoded: string,
  options?: Cookie["options"],
): Cookie =>
  Object.assign(Object.create(CookieProto), {
    name,
    value,
    valueEncoded,
    options,
  })

export const empty: Cookies = makeCookiesFromRecord({})

export const fromIterable = (cookies: Iterable<Cookie>): Cookies => {
  const record: Record<string, Cookie> = {}
  for (const cookie of cookies) {
    record[cookie.name] = cookie
  }
  return makeCookiesFromRecord(record)
}

export const fromSetCookie = (headers: Iterable<string> | string): Cookies => {
  const arrayHeaders = typeof headers === "string" ? [headers] : headers
  const cookies: Array<Cookie> = []
  for (const header of arrayHeaders) {
    const cookie = parseSetCookie(header.trim())
    if (Option.isSome(cookie)) {
      cookies.push(cookie.value)
    }
  }
  return fromIterable(cookies)
}

export const unsafeMakeCookie = (
  name: string,
  value: string,
  options?: Cookie["options"] | undefined,
): Cookie => cookieFromParts(name, value, encodeURIComponent(value), options)

export const isEmpty = (self: Cookies): boolean => {
  for (const _ in self.cookies) return false
  return true
}

export const get = (self: Cookies, name: string): Option.Option<Cookie> =>
  name in self.cookies ? Option.some(self.cookies[name]) : Option.none()

export const getValue = (self: Cookies, name: string): Option.Option<string> =>
  Option.map(get(self, name), (cookie) => cookie.value)

export const setCookie = (self: Cookies, cookie: Cookie): Cookies =>
  makeCookiesFromRecord({ ...self.cookies, [cookie.name]: cookie })

export const unsafeSet = (
  self: Cookies,
  name: string,
  value: string,
  options?: Cookie["options"],
): Cookies => setCookie(self, unsafeMakeCookie(name, value, options))

export const unsafeSetAll = (
  self: Cookies,
  cookies: Iterable<readonly [name: string, value: string, options?: Cookie["options"]]>,
): Cookies => {
  const record: Record<string, Cookie> = { ...self.cookies }
  for (const [name, value, options] of cookies) {
    record[name] = unsafeMakeCookie(name, value, options)
  }
  return makeCookiesFromRecord(record)
}

export const remove = (self: Cookies, name: string): Cookies => {
  const { [name]: _, ...rest } = self.cookies
  return makeCookiesFromRecord(rest)
}

export const merge = (self: Cookies, that: Cookies): Cookies =>
  makeCookiesFromRecord({ ...self.cookies, ...that.cookies })

export function serializeCookie(self: Cookie): string {
  let str = self.name + "=" + self.valueEncoded

  if (self.options === undefined) {
    return str
  }
  const options = self.options

  if (options.maxAge !== undefined) {
    const maxAge = Duration.toSeconds(options.maxAge)
    str += "; Max-Age=" + Math.trunc(maxAge)
  }

  if (options.domain !== undefined) {
    str += "; Domain=" + options.domain
  }

  if (options.path !== undefined) {
    str += "; Path=" + options.path
  }

  if (options.priority !== undefined) {
    switch (options.priority) {
      case "low":
        str += "; Priority=Low"
        break
      case "medium":
        str += "; Priority=Medium"
        break
      case "high":
        str += "; Priority=High"
        break
    }
  }

  if (options.expires !== undefined) {
    str += "; Expires=" + options.expires.toUTCString()
  }

  if (options.httpOnly) {
    str += "; HttpOnly"
  }

  if (options.secure) {
    str += "; Secure"
  }

  if (options.partitioned) {
    str += "; Partitioned"
  }

  if (options.sameSite !== undefined) {
    switch (options.sameSite) {
      case "lax":
        str += "; SameSite=Lax"
        break
      case "strict":
        str += "; SameSite=Strict"
        break
      case "none":
        str += "; SameSite=None"
        break
    }
  }

  return str
}

export const toCookieHeader = (self: Cookies): string =>
  Object.values(self.cookies)
    .map((cookie) => `${cookie.name}=${cookie.valueEncoded}`)
    .join("; ")

export const toRecord = (self: Cookies): Record<string, string> => {
  const record: Record<string, string> = {}
  for (const cookie of Object.values(self.cookies)) {
    record[cookie.name] = cookie.value
  }
  return record
}

export const toSetCookieHeaders = (self: Cookies): Array<string> =>
  Object.values(self.cookies).map(serializeCookie)

export function parseHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {}

  const strLen = header.length
  let pos = 0
  let terminatorPos = 0

  while (true) {
    if (terminatorPos === strLen) break
    terminatorPos = header.indexOf(";", pos)
    if (terminatorPos === -1) terminatorPos = strLen

    let eqIdx = header.indexOf("=", pos)
    if (eqIdx === -1) break
    if (eqIdx > terminatorPos) {
      pos = terminatorPos + 1
      continue
    }

    const key = header.substring(pos, eqIdx++).trim()
    if (result[key] === undefined) {
      const val =
        header.charCodeAt(eqIdx) === 0x22
          ? header.substring(eqIdx + 1, terminatorPos - 1).trim()
          : header.substring(eqIdx, terminatorPos).trim()

      result[key] = !(val.indexOf("%") === -1) ? tryDecodeURIComponent(val) : val
    }

    pos = terminatorPos + 1
  }

  return result
}

// eslint-disable-next-line no-control-regex
const fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/

function parseSetCookie(header: string): Option.Option<Cookie> {
  const parts = header
    .split(";")
    .map((_) => _.trim())
    .filter((_) => _ !== "")
  if (parts.length === 0) {
    return Option.none()
  }

  const firstEqual = parts[0].indexOf("=")
  if (firstEqual === -1) {
    return Option.none()
  }
  const name = parts[0].slice(0, firstEqual)
  if (!fieldContentRegExp.test(name)) {
    return Option.none()
  }

  const valueEncoded = parts[0].slice(firstEqual + 1)
  const value = tryDecodeURIComponent(valueEncoded)

  if (parts.length === 1) {
    return Option.some(cookieFromParts(name, value, valueEncoded))
  }

  const options: Types.Mutable<Cookie["options"]> = {}

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const equalIndex = part.indexOf("=")
    const key = equalIndex === -1 ? part : part.slice(0, equalIndex).trim()
    const value = equalIndex === -1 ? undefined : part.slice(equalIndex + 1).trim()

    switch (key.toLowerCase()) {
      case "domain": {
        if (value === undefined) break
        const domain = value.trim().replace(/^\./, "")
        if (domain) options.domain = domain
        break
      }
      case "expires": {
        if (value === undefined) break
        const date = new Date(value)
        if (!isNaN(date.getTime())) options.expires = date
        break
      }
      case "max-age": {
        if (value === undefined) break
        const maxAge = parseInt(value, 10)
        if (!isNaN(maxAge)) options.maxAge = Duration.seconds(maxAge)
        break
      }
      case "path": {
        if (value === undefined) break
        if (value[0] === "/") options.path = value
        break
      }
      case "priority": {
        if (value === undefined) break
        switch (value.toLowerCase()) {
          case "low":
            options.priority = "low"
            break
          case "medium":
            options.priority = "medium"
            break
          case "high":
            options.priority = "high"
            break
        }
        break
      }
      case "httponly": {
        options.httpOnly = true
        break
      }
      case "secure": {
        options.secure = true
        break
      }
      case "partitioned": {
        options.partitioned = true
        break
      }
      case "samesite": {
        if (value === undefined) break
        switch (value.toLowerCase()) {
          case "lax":
            options.sameSite = "lax"
            break
          case "strict":
            options.sameSite = "strict"
            break
          case "none":
            options.sameSite = "none"
            break
        }
        break
      }
    }
  }

  return Option.some(
    cookieFromParts(
      name,
      value,
      valueEncoded,
      Object.keys(options).length > 0 ? options : undefined,
    ),
  )
}

const tryDecodeURIComponent = (str: string): string => {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}
