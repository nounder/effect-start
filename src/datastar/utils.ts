import type {
  EventCallbackHandler,
  HTMLOrSVG,
  Modifiers,
  Paths,
} from "./engine.ts"

/*********
 * dom.ts
 *********/
export const isHTMLOrSVG = (el: Node): el is HTMLOrSVG =>
  el instanceof HTMLElement
  || el instanceof SVGElement
  || el instanceof MathMLElement

/*********
 * math.ts
 *********/
export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

export const lerp = (
  min: number,
  max: number,
  t: number,
  clamped = true,
): number => {
  const v = min + (max - min) * t
  return clamped ? clamp(v, min, max) : v
}

export const inverseLerp = (
  min: number,
  max: number,
  value: number,
  clamped = true,
): number => {
  if (value < min) return 0
  if (value > max) return 1
  const v = (value - min) / (max - min)
  return clamped ? clamp(v, min, max) : v
}

export const fit = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  clamped = true,
  rounded = false,
): number => {
  const t = inverseLerp(inMin, inMax, value, clamped)
  const fitted = lerp(outMin, outMax, t, clamped)
  return rounded ? Math.round(fitted) : fitted
}

/*********
 * text.ts
 *********/
export const kebab = (str: string): string =>
  str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-z])([0-9]+)/gi, "$1-$2")
    .replace(/([0-9]+)([a-z])/gi, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()

export const camel = (str: string): string =>
  kebab(str).replace(/-./g, (x) => x[1].toUpperCase())

export const snake = (str: string): string => kebab(str).replace(/-/g, "_")

export const pascal = (str: string): string =>
  camel(str).replace(/(^.|(?<=\.).)/g, (x) => x[0].toUpperCase())

export const title = (str: string): string =>
  str.replace(/\b\w/g, (char) => char.toUpperCase())

export const jsStrToObject = (raw: string) => {
  try {
    return JSON.parse(raw)
  } catch {
    return Function(`return (${raw})`)()
  }
}

const caseFns: Record<string, (s: string) => string> = {
  camel: (str) => str.replace(/-[a-z]/g, (x) => x[1].toUpperCase()),
  snake: (str) => str.replace(/-/g, "_"),
  pascal: (str) => str[0].toUpperCase() + caseFns.camel(str.slice(1)),
}

export const modifyCasing = (
  str: string,
  mods: Modifiers,
  defaultCase = "camel",
): string => {
  for (const c of mods.get("case") || [defaultCase]) {
    str = caseFns[c]?.(str) || str
  }
  return str
}

export const aliasify = (name: string) => `data-${name}`

/*********
 * tags.ts
 *********/
export const tagToMs = (args: Set<string>) => {
  if (!args || args.size <= 0) return 0
  for (const arg of args) {
    if (arg.endsWith("ms")) {
      return +arg.replace("ms", "")
    }
    if (arg.endsWith("s")) {
      return +arg.replace("s", "") * 1000
    }
    try {
      return Number.parseFloat(arg)
    } catch (_) {}
  }
  return 0
}

export const tagHas = (
  tags: Set<string>,
  tag: string,
  defaultValue = false,
) => {
  if (!tags) return defaultValue
  return tags.has(tag.toLowerCase())
}

export const tagFirst = (tags?: Set<string>, defaultValue = ""): string => {
  if (tags && tags.size > 0) {
    for (const tag of tags) {
      return tag
    }
  }
  return defaultValue
}

/*********
 * polyfills.ts
 *********/
export const hasOwn: (obj: object, prop: PropertyKey) => boolean =
  // @ts-ignore
  Object.hasOwn ?? Object.prototype.hasOwnProperty.call

/*********
 * paths.ts
 *********/
export const isPojo = (obj: any): obj is Record<string, any> =>
  obj !== null
  && typeof obj === "object"
  && (Object.getPrototypeOf(obj) === Object.prototype
    || Object.getPrototypeOf(obj) === null)

export const isEmpty = (obj: Record<string, any>): boolean => {
  for (const prop in obj) {
    if (hasOwn(obj, prop)) {
      return false
    }
  }
  return true
}

export const updateLeaves = (
  obj: Record<string, any>,
  fn: (oldValue: any) => any,
) => {
  for (const key in obj) {
    const val = obj[key]
    if (isPojo(val) || Array.isArray(val)) {
      updateLeaves(val, fn)
    } else {
      obj[key] = fn(val)
    }
  }
}

export const pathToObj = (paths: Paths): Record<string, any> => {
  const result: Record<string, any> = {}
  for (const [path, value] of paths) {
    const keys = path.split(".")
    const lastKey = keys.pop()!
    const obj = keys.reduce((acc, key) => (acc[key] ??= {}), result)
    obj[lastKey] = value
  }
  return result
}

/*********
 * timing.ts
 *********/
export const delay = (
  callback: EventCallbackHandler,
  wait: number,
): EventCallbackHandler => {
  return (...args: Array<any>) => {
    setTimeout(() => {
      callback(...args)
    }, wait)
  }
}

export const throttle = (
  callback: EventCallbackHandler,
  wait: number,
  leading = true,
  trailing = false,
  debounce = false,
): EventCallbackHandler => {
  let lastArgs: Parameters<EventCallbackHandler> | null = null
  let timer: any = 0

  return (...args: Array<any>) => {
    if (leading && !timer) {
      callback(...args)
      lastArgs = null
    } else {
      lastArgs = args
    }
    if (!timer || debounce) {
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        if (trailing && lastArgs !== null) {
          callback(...lastArgs)
        }
        lastArgs = null
        timer = 0
      }, wait)
    }
  }
}

export const modifyTiming = (
  callback: EventCallbackHandler,
  mods: Modifiers,
): EventCallbackHandler => {
  const delayArgs = mods.get("delay")
  if (delayArgs) {
    const wait = tagToMs(delayArgs)
    callback = delay(callback, wait)
  }

  const debounceArgs = mods.get("debounce")
  if (debounceArgs) {
    const wait = tagToMs(debounceArgs)
    const leading = tagHas(debounceArgs, "leading", false)
    const trailing = !tagHas(debounceArgs, "notrailing", false)
    callback = throttle(callback, wait, leading, trailing, true)
  }

  const throttleArgs = mods.get("throttle")
  if (throttleArgs) {
    const wait = tagToMs(throttleArgs)
    const leading = !tagHas(throttleArgs, "noleading", false)
    const trailing = tagHas(throttleArgs, "trailing", false)
    callback = throttle(callback, wait, leading, trailing)
  }

  return callback
}

/*********
 * view-transitions.ts
 *********/
export const supportsViewTransitions = !!document.startViewTransition

export const modifyViewTransition = (
  callback: EventCallbackHandler,
  mods: Modifiers,
): EventCallbackHandler => {
  if (mods.has("viewtransition") && supportsViewTransitions) {
    const cb = callback
    callback = (...args: Array<any>) =>
      document.startViewTransition(() => cb(...args))
  }

  return callback
}
