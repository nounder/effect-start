/**
 * Port of Tailwind CSS v4.1 utilities and variants. Output is nested CSS; lowering is left to the bundler.
 *
 * Copyright (c) Tailwind Labs, Inc. MIT License.
 * @see https://github.com/tailwindlabs/tailwindcss/tree/main/packages/tailwindcss/src
 */
import * as DefaultTheme from "./internal/DefaultTheme.ts"

export interface Options {
  /** `"initial"` removes a variable, or a whole namespace with `"--color-*"`. */
  readonly variables?: Readonly<Record<string, string>>
  /** Emitted only when an `--animate-*` variable referencing them is used. */
  readonly keyframes?: Readonly<Record<string, string>>
  /** eg. `{ dark: "&:where(.dark, .dark *)" }`. An array lists alternatives. */
  readonly variants?: Readonly<Record<string, string | ReadonlyArray<string>>>
  readonly preflight?: boolean
}

export interface TailwindEngine {
  generate(candidates: Iterable<string>): string
}

export function make(options: Options = {}): TailwindEngine {
  const theme = new Theme()
  for (const line of DefaultTheme.variables.trim().split("\n")) {
    theme.add(line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 2), ThemeFlag.None)
  }
  for (const line of DefaultTheme.referenceVariables.trim().split("\n")) {
    const name = line.slice(0, line.indexOf(":"))
    theme.add(name, line.slice(line.indexOf(":") + 2), ThemeFlag.Inline | ThemeFlag.Reference)
  }
  for (const block of DefaultTheme.keyframes.trimStart().split(/^(?=@keyframes )/m)) {
    theme.keyframes.set(block.slice(11, block.indexOf(" ", 11)), block)
  }
  for (const [name, value] of Object.entries(options.variables ?? {})) {
    if (!name.startsWith("--")) throw new Error(`Theme variable must start with "--": ${name}`)
    theme.add(name, value, ThemeFlag.None)
  }
  for (const [name, body] of Object.entries(options.keyframes ?? {})) {
    theme.keyframes.set(name, `@keyframes ${name} {\n  ${body}\n}\n`)
  }

  const design = new DesignSystem(theme)
  for (const [name, selectors] of Object.entries(options.variants ?? {})) {
    design.variants.selectors(name, typeof selectors === "string" ? [selectors] : selectors)
  }
  const preflight = options.preflight !== false
  return {
    generate: memoize((candidates) => design.generate(candidates, preflight)),
  }
}

function memoize(fn: (candidates: Set<string>) => string): (candidates: Iterable<string>) => string {
  let previous: Array<string> = []
  let lastSet: Set<string> | undefined
  let result = ""
  return (candidates) => {
    const tokens = Array.from(candidates)
    if (lastSet && tokens.length === previous.length) {
      let i = 0
      while (i < tokens.length && tokens[i] === previous[i]) i++
      if (i === tokens.length) return result
    }
    const set = new Set(tokens)
    if (lastSet?.size !== set.size || !set.isSubsetOf(lastSet)) {
      result = fn(set)
      lastSet = set
    }
    previous = tokens
    return result
  }
}

/** Targets browsers without `@property` support (Safari < 16.4, Firefox < 128). */
const PROPERTIES_SUPPORTS =
  "((-webkit-hyphens: none) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color:rgb(from red r g b))))"

const ThemeFlag = { None: 0, Inline: 1, Reference: 2 } as const

class Theme {
  readonly values = new Map<string, { value: string; flags: number }>()
  readonly keyframes = new Map<string, string>()

  add(name: string, value: string, flags: number) {
    if (name.endsWith("-*")) {
      if (value !== "initial") throw new Error(`Invalid theme value \`${value}\` for namespace \`${name}\``)
      if (name === "--*") this.values.clear()
      else this.#clearNamespace(name.slice(0, -2))
    }
    if (value === "initial") this.values.delete(name)
    else this.values.set(name, { value, flags })
  }

  #clearNamespace(ns: string) {
    const ignored = IGNORED_THEME_KEYS.get(ns) ?? []
    for (const key of this.values.keys()) {
      if (key.startsWith(ns) && !ignored.some((i) => key.startsWith(i))) this.values.delete(key)
    }
  }

  #key(value: string | null, namespaces: ReadonlyArray<string>): string | null {
    for (const ns of namespaces) {
      let key = value === null ? ns : `${ns}-${value}`
      if (!this.values.has(key)) {
        if (value === null || !value.includes(".")) continue
        key = `${ns}-${value.replaceAll(".", "_")}`
        if (!this.values.has(key)) continue
      }
      if (!isIgnoredThemeKey(key, ns)) return key
    }
    return null
  }

  #ref(key: string): string {
    const entry = this.values.get(key)!
    if (entry.flags & ThemeFlag.Inline) return entry.value
    return `var(${escapeClassName(key)}${entry.flags & ThemeFlag.Reference ? `, ${entry.value}` : ""})`
  }

  resolve(value: string | null, namespaces: ReadonlyArray<string>): string | null {
    const key = this.#key(value, namespaces)
    return key === null ? null : this.#ref(key)
  }

  resolveValue(value: string | null, namespaces: ReadonlyArray<string>): string | null {
    const key = this.#key(value, namespaces)
    return key === null ? null : this.values.get(key)!.value
  }

  resolveWith(
    value: string,
    namespaces: ReadonlyArray<string>,
    nested: ReadonlyArray<string>,
  ): [string, Record<string, string>] | null {
    const key = this.#key(value, namespaces)
    if (key === null) return null
    const extra: Record<string, string> = {}
    for (const name of nested) {
      if (this.values.has(`${key}${name}`)) extra[name] = this.#ref(`${key}${name}`)
    }
    return [this.#ref(key), extra]
  }

  get(keys: ReadonlyArray<string>): string | null {
    for (const key of keys) {
      const entry = this.values.get(key)
      if (entry) return entry.value
    }
    return null
  }

  namespace(ns: string): Map<string | null, string> {
    const result = new Map<string | null, string>()
    const prefix = `${ns}-`
    for (const [key, entry] of this.values) {
      if (key === ns) result.set(null, entry.value)
      else if (key.startsWith(`${prefix}-`)) result.set(key.slice(ns.length), entry.value)
      else if (key.startsWith(prefix)) result.set(key.slice(prefix.length), entry.value)
    }
    return result
  }
}

/** Theme keys that share a namespace prefix but belong to another namespace. */
const pairs = (text: string) =>
  text.split(";").map((pair) => [pair.slice(0, pair.indexOf(" ")), pair.slice(pair.indexOf(" ") + 1)] as const)

/** `namespace ignored-key ignored-key` */
const IGNORED_THEME_KEYS = new Map(
  `
--font --font-weight --font-size
--inset --inset-shadow --inset-ring
--text --text-color --text-decoration-color --text-decoration-thickness --text-indent --text-shadow --text-underline-offset
--grid-column --grid-column-start --grid-column-end
--grid-row --grid-row-start --grid-row-end
`
    .trim()
    .split("\n")
    .map((line) => [line.slice(0, line.indexOf(" ")), line.slice(line.indexOf(" ") + 1).split(" ")]),
)

function isIgnoredThemeKey(key: string, ns: string): boolean {
  return (IGNORED_THEME_KEYS.get(ns) ?? []).some((i) => key === i || key.startsWith(`${i}-`))
}

type Node = Decl | Rule | Property

interface Decl {
  kind: "decl"
  property: string
  value: string | undefined
  important?: boolean
}

/** Style rule, or at-rule when `selector` starts with "@". */
interface Rule {
  kind: "rule"
  selector: string
  nodes: Array<Node>
}

interface Property {
  kind: "property"
  name: string
  initial: string | undefined
  syntax: string
  /** Print `initial-value` before `inherits`, as Tailwind does for `before:` and `after:`. */
  initialFirst?: boolean
}

const decl = (property: string, value: string | undefined): Decl => ({
  kind: "decl",
  property,
  value,
})

const rule = (selector: string, nodes: Array<Node>): Rule => ({ kind: "rule", selector, nodes })

const property = (name: string, initial?: string, syntax?: string): Property => ({
  kind: "property",
  name,
  initial,
  syntax: syntax ?? "*",
})

function cloneNodes(nodes: ReadonlyArray<Node>): Array<Node> {
  return nodes.map((node) => {
    if (node.kind === "rule") return rule(node.selector, cloneNodes(node.nodes))
    return { ...node }
  })
}

type NamedValue = { kind: "named"; value: string; fraction: string | null }
type ArbitraryValue = { kind: "arbitrary"; value: string; dataType: string | null }
type Modifier = { kind: "named" | "arbitrary"; value: string }

interface CandidateBase {
  variants: Array<Variant>
  important: boolean
  raw: string
}

type Candidate =
  | (CandidateBase & { kind: "static"; root: string })
  | (CandidateBase & {
    kind: "functional"
    root: string
    value: NamedValue | ArbitraryValue | null
    modifier: Modifier | null
  })
  | (CandidateBase & {
    kind: "arbitrary"
    property: string
    value: string
    modifier: Modifier | null
  })

type FunctionalCandidate = Extract<Candidate, { kind: "functional" }>

type Variant =
  | { kind: "arbitrary"; selector: string; relative: boolean }
  | { kind: "static"; root: string }
  | {
    kind: "functional"
    root: string
    value: { kind: "named" | "arbitrary"; value: string } | null
    modifier: Modifier | null
  }
  | { kind: "compound"; root: string; variant: Variant; modifier: Modifier | null }

type UtilityResult = Array<Node> | undefined | null

interface Utility {
  kind: "static" | "functional"
  compile: (candidate: Candidate) => UtilityResult
}

interface CompiledCandidate {
  raw: string
  variants: Array<Variant>
  rules: Array<CompiledRule>
}

class DesignSystem {
  readonly theme: Theme
  readonly utilities = new Map<string, Array<Utility>>()
  readonly variants: Variants
  readonly #variantCache = new Map<string, Variant | null>()
  readonly #compiled = new Map<string, CompiledCandidate | null>()

  constructor(theme: Theme) {
    this.theme = theme
    registerUtilities(this)
    this.variants = createVariants(theme)
  }

  hasUtility(root: string, kind: "static" | "functional"): boolean {
    return this.utilities.get(root)?.some((u) => u.kind === kind) ?? false
  }

  parseVariant(raw: string): Variant | null {
    let variant = this.#variantCache.get(raw)
    if (variant === undefined) {
      variant = parseVariant(raw, this)
      this.#variantCache.set(raw, variant)
    }
    return variant
  }

  #sortedRules(candidates: Set<string>) {
    for (const raw of this.#compiled.keys()) {
      if (!candidates.has(raw)) this.#compiled.delete(raw)
    }
    const activeVariants = new Set<Variant>()
    const entries: Array<{ rule: CompiledRule; variants: bigint; raw: string }> = []
    const parsed: Array<CompiledCandidate> = []
    for (const raw of candidates) {
      let compiled = this.#compiled.get(raw)
      if (compiled === undefined) {
        const rules: Array<CompiledRule> = []
        const parsedCandidates = parseCandidate(raw, this)
        for (const candidate of parsedCandidates) rules.push(...compileCandidate(candidate, this))
        compiled = rules.length ? { raw, variants: parsedCandidates[0].variants, rules } : null
        this.#compiled.set(raw, compiled)
      }
      if (compiled === null) continue
      parsed.push(compiled)
      for (const variant of compiled.variants) activeVariants.add(variant)
    }
    // Compound variants share their nested variants with other cached candidates.
    for (const variant of activeVariants) {
      if (variant.kind === "compound") activeVariants.add(variant.variant)
    }
    for (const [raw, variant] of this.#variantCache) {
      if (variant === null || !activeVariants.has(variant)) this.#variantCache.delete(raw)
    }
    const order = this.variants.order(activeVariants)
    for (const compiled of parsed) {
      let variants = 0n
      for (const variant of compiled.variants) variants |= 1n << BigInt(order.get(variant)!)
      for (const rule of compiled.rules) entries.push({ rule, variants, raw: compiled.raw })
    }
    entries.sort((a, b) => {
      if (a.variants !== b.variants) return a.variants < b.variants ? -1 : 1
      const ao = a.rule.sort.order
      const bo = b.rule.sort.order
      let i = 0
      while (i < ao.length && i < bo.length && ao[i] === bo[i]) i++
      return (
        (ao[i] ?? Infinity) - (bo[i] ?? Infinity) ||
        b.rule.sort.count - a.rule.sort.count ||
        compareNatural(a.raw, b.raw)
      )
    })
    return entries
  }

  generate(candidates: Set<string>, preflight: boolean): string {
    const ctx: PrintContext = { theme: this.theme, properties: new Map(), variables: new Set() }
    let utilities = ""
    for (const entry of this.#sortedRules(candidates)) {
      const printed = (entry.rule.printed ??= printCached(entry.rule.node, this.theme))
      utilities += printed.css
      for (const prop of printed.properties) {
        if (!ctx.properties.has(prop.name)) ctx.properties.set(prop.name, prop)
      }
      for (const name of printed.variables) ctx.variables.add(name)
    }
    if (preflight) collectVariables(DefaultTheme.preflight, ctx.variables)
    const animations = new Set<string>()
    for (const name of ctx.variables) {
      const entry = this.theme.values.get(name)
      if (!entry) continue
      collectVariables(entry.value, ctx.variables)
      if (name.startsWith("--animate-")) {
        for (const word of entry.value.split(/[\s,]+/)) {
          const block = this.theme.keyframes.get(word)
          if (block !== undefined && !animations.has(word)) {
            animations.add(word)
            collectVariables(block, ctx.variables)
          }
        }
      }
    }

    let css = `@layer theme, base, components, utilities;\n${this.#themeLayer(ctx.variables)}${
      preflight ? DefaultTheme.preflight : ""
    }@layer utilities {\n${utilities}}\n`

    const universal: Array<string> = []
    for (const prop of ctx.properties.values()) {
      const initial = prop.initial === undefined ? "" : `  initial-value: ${prop.initial};\n`
      const inherits = "  inherits: false;\n"
      css += `@property ${prop.name} {\n  syntax: "${prop.syntax}";\n${
        prop.initialFirst ? initial + inherits : inherits + initial
      }}\n`
      universal.push(`      ${prop.name}: ${prop.initial ?? "initial"};\n`)
    }

    for (const [name, block] of this.theme.keyframes) {
      if (animations.has(name)) css += block
    }

    if (universal.length === 0) return css
    return `@layer properties;\n${css}@layer properties {\n  @supports ${PROPERTIES_SUPPORTS} {\n    *, ::before, ::after, ::backdrop {\n${
      universal.join("")
    }    }\n  }\n}\n`
  }

  #themeLayer(used: Set<string>): string {
    let vars = ""
    for (const [name, entry] of this.theme.values) {
      if (used.has(name) && !(entry.flags & ThemeFlag.Reference)) {
        vars += `    ${name}: ${entry.value};\n`
      }
    }
    return vars === "" ? "" : `@layer theme {\n  :root, :host {\n${vars}  }\n}\n`
  }
}

function segment(input: string, separator: string): Array<string> {
  const sep = separator.charCodeAt(0)
  const parts: Array<string> = []
  const stack: Array<number> = []
  let last = 0
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    if (stack.length === 0 && c === sep) {
      parts.push(input.slice(last, i))
      last = i + 1
      continue
    }
    switch (c) {
      case 92:
        i++
        break
      case 39:
      case 34:
        while (++i < input.length) {
          const q = input.charCodeAt(i)
          if (q === 92) i++
          else if (q === c) break
        }
        break
      case 40:
        stack.push(41)
        break
      case 91:
        stack.push(93)
        break
      case 123:
        stack.push(125)
        break
      case 41:
      case 93:
      case 125:
        if (stack.length > 0 && c === stack[stack.length - 1]) stack.pop()
        break
    }
  }
  parts.push(input.slice(last))
  return parts
}

function isValidArbitrary(input: string): boolean {
  const stack: Array<number> = []
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    switch (c) {
      case 92:
        i++
        break
      case 39:
      case 34:
        while (++i < input.length) {
          const q = input.charCodeAt(i)
          if (q === 92) i++
          else if (q === c) break
        }
        break
      case 40:
        stack.push(41)
        break
      case 91:
        stack.push(93)
        break
      case 41:
      case 93:
      case 125:
        if (stack.length === 0) return false
        if (c === stack[stack.length - 1]) stack.pop()
        break
      case 59:
        if (stack.length === 0) return false
        break
    }
  }
  return true
}

const MATH_FUNCTIONS = "calc min max clamp mod rem sin cos tan asin acos atan atan2 pow sqrt hypot log exp round".split(
  " ",
)

function hasMathFn(value: string): boolean {
  return value.includes("(") && MATH_FUNCTIONS.some((fn) => value.includes(`${fn}(`))
}

/** `_` becomes a space, except in `url()` and variable names. */
function decodeArbitraryValue(input: string): string {
  if (!input.includes("(")) return convertUnderscores(input, false)
  let out = ""
  const stack: Array<string> = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === "(") {
      const fnStart = out.search(/[\w-]*$/)
      const fn = out.slice(fnStart)
      stack.push(fn)
      out += ch
      i++
      if (fn === "url" || fn.endsWith("_url")) {
        const close = matchParen(input, i - 1)
        out += input.slice(i, close + 1)
        stack.pop()
        i = close + 1
        continue
      }
      if (fn === "var" || fn.endsWith("_var") || fn === "theme" || fn.endsWith("_theme")) {
        const match = /^[^,()]*/.exec(input.slice(i))![0]
        out += convertUnderscores(match, true)
        i += match.length
      }
      continue
    }
    if (ch === ")") stack.pop()
    if (ch === "\\" && input[i + 1] === "_") {
      out += "_"
      i += 2
      continue
    }
    out += ch === "_" ? " " : ch
    i++
  }
  return addMathSpaces(out)
}

function matchParen(input: string, open: number): number {
  let depth = 0
  for (let i = open; i < input.length; i++) {
    if (input[i] === "(") depth++
    else if (input[i] === ")" && --depth === 0) return i
  }
  return input.length - 1
}

function convertUnderscores(input: string, keep: boolean): string {
  let out = ""
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === "\\" && input[i + 1] === "_") {
      out += "_"
      i++
    } else out += ch === "_" && !keep ? " " : ch
  }
  return out
}

function addMathSpaces(input: string): string {
  if (!MATH_FUNCTIONS.some((fn) => input.includes(fn))) return input
  let out = ""
  const stack: Array<boolean> = []
  let valuePos: number | null = null
  let lastValuePos: number | null = null
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    if ((c >= 48 && c <= 57) || (valuePos !== null && (c === 37 || (c >= 97 && c <= 122) || (c >= 65 && c <= 90)))) {
      valuePos = i
    } else {
      lastValuePos = valuePos
      valuePos = null
    }
    if (c === 40) {
      out += input[i]
      let start = i
      for (let j = i - 1; j >= 0; j--) {
        const p = input.charCodeAt(j)
        if ((p >= 48 && p <= 57) || (p >= 97 && p <= 122)) start = j
        else break
      }
      const fn = input.slice(start, i)
      if (MATH_FUNCTIONS.includes(fn) || (stack[0] && fn === "")) stack.unshift(true)
      else stack.unshift(false)
      continue
    }
    if (c === 41) {
      out += input[i]
      stack.shift()
    } else if (c === 44 && stack[0]) {
      out += ", "
    } else if (c === 32 && stack[0] && out.charCodeAt(out.length - 1) === 32) {
      continue
    } else if ((c === 43 || c === 42 || c === 47 || c === 45) && stack[0]) {
      const trimmed = out.trimEnd()
      const prev = trimmed.charCodeAt(trimmed.length - 1)
      const prevPrev = trimmed.charCodeAt(trimmed.length - 2)
      const next = input.charCodeAt(i + 1)
      if ((prev === 101 || prev === 69) && prevPrev >= 48 && prevPrev <= 57) out += input[i]
      else if (prev === 43 || prev === 42 || prev === 47 || prev === 45) out += input[i]
      else if (prev === 40 || prev === 44) out += input[i]
      else if (input.charCodeAt(i - 1) === 32) out += `${input[i]} `
      else if (
        (prev >= 48 && prev <= 57) ||
        (next >= 48 && next <= 57) ||
        prev === 41 ||
        next === 40 ||
        next === 43 ||
        next === 42 ||
        next === 47 ||
        next === 45 ||
        (lastValuePos !== null && lastValuePos === i - 1)
      ) {
        out += ` ${input[i]} `
      } else out += input[i]
    } else out += input[i]
  }
  return out
}

const NAMED_VALUE = /^[a-zA-Z0-9_.%-]+$/

function parseModifier(raw: string): Modifier | null {
  if (raw[0] === "[" && raw[raw.length - 1] === "]") {
    const value = decodeArbitraryValue(raw.slice(1, -1))
    return !isValidArbitrary(value) || value.trim().length === 0 ? null : { kind: "arbitrary", value }
  }
  if (raw[0] === "(" && raw[raw.length - 1] === ")") {
    const inner = raw.slice(1, -1)
    if (inner[0] !== "-" || inner[1] !== "-" || !isValidArbitrary(inner)) return null
    return { kind: "arbitrary", value: decodeArbitraryValue(`var(${inner})`) }
  }
  return NAMED_VALUE.test(raw) ? { kind: "named", value: raw } : null
}

function* findRoots(input: string, exists: (root: string) => boolean): IterableIterator<[string, string | null]> {
  if (exists(input)) yield [input, null]
  let idx = input.lastIndexOf("-")
  while (idx > 0) {
    const root = input.slice(0, idx)
    if (exists(root)) {
      const value = input.slice(idx + 1)
      if (value === "" || (root === "@" && exists("@") && input[idx] === "-")) break
      yield [root, value]
    }
    idx = input.lastIndexOf("-", idx - 1)
  }
  if (input[0] === "@" && exists("@")) yield ["@", input.slice(1)]
}

function parseCandidate(raw: string, design: DesignSystem): Array<Candidate> {
  const parts = segment(raw, ":")
  let base = parts.pop()!
  const variants: Array<Variant> = []
  for (let i = parts.length - 1; i >= 0; i--) {
    const variant = design.parseVariant(parts[i])
    if (variant === null) return []
    variants.push(variant)
  }
  let important = false
  if (base[base.length - 1] === "!") {
    important = true
    base = base.slice(0, -1)
  } else if (base[0] === "!") {
    important = true
    base = base.slice(1)
  }
  const result: Array<Candidate> = []
  if (design.hasUtility(base, "static") && !base.includes("[")) {
    result.push({ kind: "static", root: base, variants, important, raw })
  }
  const [rootPart, modifierPart = null, extra] = segment(base, "/")
  if (extra !== undefined) return result
  const modifier = modifierPart === null ? null : parseModifier(modifierPart)
  if (modifierPart !== null && modifier === null) return result

  if (rootPart[0] === "[") {
    if (rootPart[rootPart.length - 1] !== "]") return result
    const code = rootPart.charCodeAt(1)
    if (code !== 45 && !(code >= 97 && code <= 122)) return result
    const inner = rootPart.slice(1, -1)
    const colon = inner.indexOf(":")
    if (colon <= 0 || colon === inner.length - 1) return result
    const value = decodeArbitraryValue(inner.slice(colon + 1))
    if (!isValidArbitrary(value)) return result
    result.push({ kind: "arbitrary", property: inner.slice(0, colon), value, modifier, variants, important, raw })
    return result
  }

  let roots: Iterable<[string, string | null]>
  if (rootPart[rootPart.length - 1] === "]") {
    const idx = rootPart.indexOf("-[")
    if (idx === -1) return result
    const root = rootPart.slice(0, idx)
    if (!design.hasUtility(root, "functional")) return result
    roots = [[root, rootPart.slice(idx + 1)]]
  } else if (rootPart[rootPart.length - 1] === ")") {
    const idx = rootPart.indexOf("-(")
    if (idx === -1) return result
    const root = rootPart.slice(0, idx)
    if (!design.hasUtility(root, "functional")) return result
    let inner = rootPart.slice(idx + 2, -1)
    const typed = segment(inner, ":")
    let dataType: string | null = null
    if (typed.length === 2) {
      dataType = typed[0]
      inner = typed[1]
    }
    if (inner[0] !== "-" || inner[1] !== "-" || !isValidArbitrary(inner)) return result
    roots = [[root, dataType === null ? `[var(${inner})]` : `[${dataType}:var(${inner})]`]]
  } else {
    roots = findRoots(rootPart, (root) => design.hasUtility(root, "functional"))
  }

  for (const [root, valuePart] of roots) {
    const candidate: FunctionalCandidate = {
      kind: "functional",
      root,
      modifier,
      value: null,
      variants,
      important,
      raw,
    }
    if (valuePart === null) {
      result.push(candidate)
      continue
    }
    const bracket = valuePart.indexOf("[")
    if (bracket !== -1) {
      if (valuePart[valuePart.length - 1] !== "]") return result
      let value = decodeArbitraryValue(valuePart.slice(bracket + 1, -1))
      if (!isValidArbitrary(value)) continue
      let dataType: string | null = null
      for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i)
        if (code === 58) {
          dataType = value.slice(0, i)
          value = value.slice(i + 1)
          break
        }
        if (!(code === 45 || (code >= 97 && code <= 122))) break
      }
      if (value.length === 0 || value.trim().length === 0 || dataType === "") continue
      candidate.value = { kind: "arbitrary", dataType, value }
    } else {
      if (!NAMED_VALUE.test(valuePart)) continue
      const fraction = modifierPart === null || modifier?.kind === "arbitrary" ? null : `${valuePart}/${modifierPart}`
      candidate.value = { kind: "named", value: valuePart, fraction }
    }
    result.push(candidate)
  }
  return result
}

function parseVariant(raw: string, design: DesignSystem): Variant | null {
  if (raw[0] === "[" && raw[raw.length - 1] === "]") {
    if (raw[1] === "@" && raw.includes("&")) return null
    let selector = decodeArbitraryValue(raw.slice(1, -1))
    if (!isValidArbitrary(selector) || selector.trim().length === 0) return null
    const relative = selector[0] === ">" || selector[0] === "+" || selector[0] === "~"
    if (selector[0] === "@") selector = selector.replace(/^(@[\w-]+)\s*/, "$1 ")
    else if (!relative && !selector.includes("&")) selector = `&:is(${selector})`
    return { kind: "arbitrary", selector, relative }
  }
  const [name, modifierRaw = null, extra] = segment(raw, "/")
  if (extra !== undefined) return null
  const variants = design.variants
  for (const [root, value] of findRoots(name, (r) => variants.has(r))) {
    const def = variants.get(root)!
    switch (def.kind) {
      case "static":
        return value !== null || modifierRaw !== null ? null : { kind: "static", root }
      case "functional": {
        const modifier = modifierRaw === null ? null : parseModifier(modifierRaw)
        if (modifierRaw !== null && modifier === null) return null
        if (value === null) return { kind: "functional", root, modifier, value: null }
        if (value[value.length - 1] === "]") {
          if (value[0] !== "[") continue
          const v = decodeArbitraryValue(value.slice(1, -1))
          if (!isValidArbitrary(v) || v.trim().length === 0) return null
          return { kind: "functional", root, modifier, value: { kind: "arbitrary", value: v } }
        }
        if (value[value.length - 1] === ")") {
          if (value[0] !== "(") continue
          const v = decodeArbitraryValue(value.slice(1, -1))
          if (!isValidArbitrary(v) || v.trim().length === 0 || v[0] !== "-" || v[1] !== "-") return null
          return { kind: "functional", root, modifier, value: { kind: "arbitrary", value: `var(${v})` } }
        }
        if (!NAMED_VALUE.test(value)) continue
        return { kind: "functional", root, modifier, value: { kind: "named", value } }
      }
      case "compound": {
        if (value === null) return null
        let inner = value
        let mod = modifierRaw
        if (mod && (root === "not" || root === "has" || root === "in")) {
          inner = `${inner}/${mod}`
          mod = null
        }
        const variant = design.parseVariant(inner)
        if (variant === null || !variants.compoundsWith(root, variant)) return null
        const modifier = mod === null ? null : parseModifier(mod)
        if (mod !== null && modifier === null) return null
        return { kind: "compound", root, modifier, variant }
      }
    }
  }
  return null
}

interface PropertySort {
  order: Array<number>
  count: number
}

function compileCandidate(
  candidate: Candidate,
  design: DesignSystem,
): Array<{ node: Rule; sort: PropertySort }> {
  let results: Array<Array<Node>> = []
  if (candidate.kind === "arbitrary") {
    const value = candidate.modifier
      ? applyModifier(candidate.value, candidate.modifier, design.theme)
      : candidate.value
    if (value !== null) results = [[decl(candidate.property, value)]]
  } else {
    for (const utility of design.utilities.get(candidate.root) ?? []) {
      if (utility.kind !== candidate.kind) continue
      const nodes = utility.compile(candidate)
      if (nodes === undefined) continue
      if (nodes === null) break
      results.push(nodes)
    }
  }
  const out: Array<{ node: Rule; sort: PropertySort }> = []
  for (const nodes of results) {
    const sort = propertySort(nodes)
    if (candidate.important) markImportant(nodes)
    const node = rule(`.${escapeClassName(candidate.raw)}`, nodes)
    for (const variant of candidate.variants) {
      if (design.variants.apply(node, variant) === null) return []
    }
    out.push({ node, sort })
  }
  return out
}

function markImportant(nodes: Array<Node>) {
  for (const node of nodes) {
    if (node.kind === "decl") node.important = true
    else if (node.kind === "rule") markImportant(node.nodes)
  }
}

function propertySort(nodes: Array<Node>): PropertySort {
  const order = new Set<number>()
  let count = 0
  let sorted = false
  const queue = nodes.slice()
  while (queue.length > 0) {
    const node = queue.shift()!
    if (node.kind === "decl") {
      if (node.value === undefined) continue
      count++
      if (sorted) continue
      if (node.property === "--tw-sort") {
        const idx = PROPERTY_ORDER.get(node.value)
        if (idx !== undefined) {
          order.add(idx)
          sorted = true
          continue
        }
      }
      const idx = PROPERTY_ORDER.get(node.property)
      if (idx !== undefined) order.add(idx)
    } else if (node.kind === "rule") {
      queue.push(...node.nodes)
    }
  }
  return { order: [...order].sort((a, b) => a - b), count }
}

function compareNatural(a: string, b: string): number {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    let ca = a.charCodeAt(i)
    let cb = b.charCodeAt(i)
    if (ca >= 48 && ca <= 57 && cb >= 48 && cb <= 57) {
      let ea = i + 1
      let eb = i + 1
      for (ca = a.charCodeAt(ea); ca >= 48 && ca <= 57;) ca = a.charCodeAt(++ea)
      for (cb = b.charCodeAt(eb); cb >= 48 && cb <= 57;) cb = b.charCodeAt(++eb)
      const na = a.slice(i, ea)
      const nb = b.slice(i, eb)
      const diff = Number(na) - Number(nb)
      if (diff) return diff
      if (na < nb) return -1
      if (na > nb) return 1
      continue
    }
    if (ca !== cb) return ca - cb
  }
  return a.length - b.length
}

/** `CSS.escape` */
function escapeClassName(value: string): string {
  let out = ""
  const first = value.charCodeAt(0)
  if (value.length === 1 && first === 45) return `\\${value}`
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if (c === 0) out += "�"
    else if (
      (c >= 1 && c <= 31) ||
      c === 127 ||
      (i === 0 && c >= 48 && c <= 57) ||
      (i === 1 && c >= 48 && c <= 57 && first === 45)
    ) {
      out += `\\${c.toString(16)} `
    } else if (
      c >= 128 ||
      c === 45 ||
      c === 95 ||
      (c >= 48 && c <= 57) ||
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122)
    ) {
      out += value[i]
    } else {
      out += `\\${value[i]}`
    }
  }
  return out
}

interface CompiledRule {
  node: Rule
  sort: PropertySort
  printed?: { css: string; properties: Array<Property>; variables: Array<string> }
}

interface PrintContext {
  theme: Theme
  properties: Map<string, Property>
  variables: Set<string>
}

function printCached(node: Rule, theme: Theme): NonNullable<CompiledRule["printed"]> {
  const ctx: PrintContext = { theme, properties: new Map(), variables: new Set() }
  const css = printNode(node, 1, ctx)
  return { css, properties: [...ctx.properties.values()], variables: [...ctx.variables] }
}

function collectVariables(text: string, into: Set<string>) {
  let idx = text.indexOf("var(")
  while (idx !== -1) {
    let start = idx + 4
    while (start < text.length && " \t\n\r\f".includes(text[start])) start++
    let end = start
    if (text.charCodeAt(start) === 45 && text.charCodeAt(start + 1) === 45) {
      end += 2
      for (let c = text.charCodeAt(end); isNameChar(c); c = text.charCodeAt(++end));
      into.add(text.slice(start, end))
    }
    idx = text.indexOf("var(", end)
  }
}

const isNameChar = (c: number) =>
  (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95 || c === 45 || c === 46 || c === 92

const INDENTS = Array.from({ length: 16 }, (_, i) => "  ".repeat(i))

function printNode(node: Node, depth: number, ctx: PrintContext): string {
  const indent = INDENTS[depth] ?? "  ".repeat(depth)
  switch (node.kind) {
    case "decl": {
      if (node.value === undefined || node.property === "--tw-sort") return ""
      collectVariables(node.value, ctx.variables)
      const important = node.important ? " !important" : ""
      const fallback = node.value.includes("color-mix(") ? colorMixFallback(node.value, ctx.theme) : null
      if (fallback === null) return `${indent}${node.property}: ${node.value}${important};\n`
      return `${indent}${node.property}: ${fallback}${important};\n${indent}@supports (color: color-mix(in lab, red, red)) {\n${
        INDENTS[depth + 1] ?? "  ".repeat(depth + 1)
      }${node.property}: ${node.value}${important};\n${indent}}\n`
    }
    case "property":
      if (!ctx.properties.has(node.name)) ctx.properties.set(node.name, node)
      return ""
    case "rule": {
      if (node.selector === "&") return printBody(node.nodes, depth, ctx)
      const body = printBody(node.nodes, depth + 1, ctx)
      return body === "" ? "" : `${indent}${node.selector} {\n${body}${indent}}\n`
    }
  }
}

/** Keeps only the last of identical declarations. */
function printBody(children: ReadonlyArray<Node>, depth: number, ctx: PrintContext): string {
  let body = ""
  outer: for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.kind === "decl") {
      for (let j = i + 1; j < children.length; j++) {
        const other = children[j]
        if (
          other.kind === "decl" &&
          other.property === child.property &&
          other.value === child.value &&
          other.important === child.important
        ) continue outer
      }
    }
    body += printNode(child, depth, ctx)
  }
  return body
}

function colorMixFallback(value: string, theme: Theme): string | null {
  let touched = false
  const process = (input: string): string => {
    let out = ""
    let last = 0
    let idx = input.indexOf("color-mix(")
    while (idx !== -1) {
      const open = idx + 9
      const close = matchParen(input, open)
      out += input.slice(last, idx)
      let failed = false
      let current = false
      const inner = input.slice(open + 1, close).replace(
        /var\((--[\w-]+)[^()]*(?:\([^()]*\)[^()]*)*\)|\bcurrentcolor\b/gi,
        (match, name) => {
          touched = true
          if (name === undefined) {
            current = true
            return match
          }
          let resolved: string | null = name
          const seen = new Set<string>()
          while (resolved !== null && resolved.startsWith("--")) {
            if (seen.has(resolved)) {
              resolved = null
              break
            }
            seen.add(resolved)
            const v = theme.get([resolved])
            if (v === null) resolved = null
            else if (v.toLowerCase() === "currentcolor") {
              current = true
              return match
            } else resolved = /^var\((--[\w-]+)\)$/.exec(v)?.[1] ?? v
          }
          if (resolved === null) {
            failed = true
            return match
          }
          return resolved
        },
      )
      if (failed || current) {
        const args = segment(inner, ",")
        out += args.length > 1 ? process(segment(args[1].trim(), " ")[0]) : `color-mix(${inner})`
      } else {
        out += `color-mix(${process(inner.replace(/^(\s*in\s+)(oklab|oklch|lab|lch)\b/, "$1srgb"))})`
      }
      last = close + 1
      idx = input.indexOf("color-mix(", last)
    }
    return out + input.slice(last)
  }
  const result = process(value)
  return touched ? result : null
}

function withAlpha(color: string, alpha: string | null): string {
  if (alpha === null) return color
  const n = Number(alpha)
  const value = Number.isNaN(n) ? alpha : `${n * 100}%`
  return value === "100%" ? color : `color-mix(in oklab, ${color} ${value}, transparent)`
}

function withAlphaRelative(color: string, alpha: string): string {
  const n = Number(alpha)
  return `oklab(from ${color} l a b / ${Number.isNaN(n) ? alpha : `${n * 100}%`})`
}

function applyModifier(color: string, modifier: Modifier | null, theme: Theme): string | null {
  if (!modifier) return color
  if (modifier.kind === "arbitrary") return withAlpha(color, modifier.value)
  const resolved = theme.resolve(modifier.value, ["--opacity"])
  if (resolved) return withAlpha(color, resolved)
  return isMultipleOf(modifier.value, 0.25) ? withAlpha(color, `${modifier.value}%`) : null
}

function resolveColor(candidate: FunctionalCandidate, theme: Theme, keys: ReadonlyArray<string>): string | null {
  const value = candidate.value as NamedValue
  let color: string | null
  switch (value.value) {
    case "inherit":
      color = "inherit"
      break
    case "transparent":
      color = "transparent"
      break
    case "current":
      color = "currentcolor"
      break
    default:
      color = theme.resolve(value.value, keys)
  }
  return color ? applyModifier(color, candidate.modifier, theme) : null
}

const isPositiveInteger = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && String(n) === String(value)
}

const isStrictPositiveInteger = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 && String(n) === String(value)
}

const isMultipleOf = (value: string, divisor: number) => {
  const n = Number(value)
  return n >= 0 && n % divisor === 0 && String(n) === String(value)
}

const isSpacing = (value: string) => isMultipleOf(value, 0.25)

const NUMBER = /[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?/.source
const IS_NUMBER = new RegExp(`^${NUMBER}$`)
const IS_PERCENTAGE = new RegExp(`^${NUMBER}%$`)
const IS_RATIO = new RegExp(`^${NUMBER}s*/s*${NUMBER}$`)
const IS_LENGTH = new RegExp(
  `^${NUMBER}(cm|mm|Q|in|pc|pt|px|em|ex|ch|rem|lh|rlh|vw|vh|vmin|vmax|vb|vi|svw|svh|lvw|lvh|dvw|dvh|cqw|cqh|cqi|cqb|cqmin|cqmax)$`,
)
const IS_ANGLE = new RegExp(`^${NUMBER}(deg|rad|grad|turn)$`)
const IS_VECTOR = new RegExp(`^${NUMBER} +${NUMBER} +${NUMBER}$`)
const IS_COLOR_FN = /^(rgba?|hsla?|hwb|color|(ok)?(lab|lch)|light-dark|color-mix)\(/i
const NAMED_COLORS = new Set(
  "black silver gray white maroon red purple fuchsia green lime olive yellow navy blue teal aqua aliceblue antiquewhite aquamarine azure beige bisque blanchedalmond blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen gainsboro ghostwhite gold goldenrod greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow limegreen linen magenta mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite oldlace olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue rebeccapurple rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna skyblue slateblue slategray slategrey snow springgreen steelblue tan thistle tomato turquoise violet wheat whitesmoke yellowgreen transparent currentcolor canvas canvastext linktext visitedtext activetext buttonface buttontext buttonborder field fieldtext highlight highlighttext selecteditem selecteditemtext mark marktext graytext accentcolor accentcolortext"
    .split(" "),
)

const isLength = (v: string) => IS_LENGTH.test(v) || hasMathFn(v)
const isPercentage = (v: string) => IS_PERCENTAGE.test(v) || hasMathFn(v)
const isNumber = (v: string) => IS_NUMBER.test(v) || hasMathFn(v)

const GENERIC_FONT_NAMES = new Set(
  "serif sans-serif monospace cursive fantasy system-ui ui-serif ui-sans-serif ui-monospace ui-rounded math emoji fangsong"
    .split(" "),
)

const DATA_TYPES: Record<string, (value: string) => boolean> = {
  color: (v) => v.charCodeAt(0) === 35 || IS_COLOR_FN.test(v) || NAMED_COLORS.has(v.toLowerCase()),
  length: isLength,
  percentage: isPercentage,
  ratio: (v) => IS_RATIO.test(v) || hasMathFn(v),
  number: isNumber,
  integer: isPositiveInteger,
  url: (v) => /^url\(.*\)$/.test(v),
  position: (v) => {
    let count = 0
    for (const part of segment(v, " ")) {
      if (part === "center" || part === "top" || part === "right" || part === "bottom" || part === "left") {
        count++
        continue
      }
      if (part.startsWith("var(")) continue
      if (isLength(part) || isPercentage(part)) {
        count++
        continue
      }
      return false
    }
    return count > 0
  },
  "bg-size": (v) => {
    let count = 0
    for (const part of segment(v, ",")) {
      if (part === "cover" || part === "contain") {
        count++
        continue
      }
      const values = segment(part, " ")
      if (values.length !== 1 && values.length !== 2) return false
      if (values.every((x) => x === "auto" || isLength(x) || isPercentage(x))) count++
    }
    return count > 0
  },
  "line-width": (v) =>
    segment(v, " ").every((x) => isLength(x) || isNumber(x) || x === "thin" || x === "medium" || x === "thick"),
  image: (v) => {
    let count = 0
    for (const part of segment(v, ",")) {
      if (part.startsWith("var(")) continue
      if (
        /^url\(.*\)$/.test(part) ||
        /^(repeating-)?(conic|linear|radial)-gradient\(/.test(part) ||
        /^(?:element|image|cross-fade|image-set)\(/.test(part)
      ) {
        count++
        continue
      }
      return false
    }
    return count > 0
  },
  "family-name": (v) => {
    let count = 0
    for (const part of segment(v, ",")) {
      const c = part.charCodeAt(0)
      if (c >= 48 && c <= 57) return false
      if (!part.startsWith("var(")) count++
    }
    return count > 0
  },
  "generic-name": (v) => GENERIC_FONT_NAMES.has(v),
  "absolute-size": (v) =>
    ["xx-small", "x-small", "small", "medium", "large", "x-large", "xx-large", "xxx-large"].includes(v),
  "relative-size": (v) => v === "larger" || v === "smaller",
  angle: (v) => IS_ANGLE.test(v),
  vector: (v) => IS_VECTOR.test(v),
}

function inferDataType(value: string, types: ReadonlyArray<string>): string | null {
  if (value.startsWith("var(")) return null
  for (const type of types) if (DATA_TYPES[type]?.(value)) return type
  return null
}

function replaceShadowColors(value: string, fn: (color: string) => string): string {
  return segment(value, ",")
    .map((shadow) => {
      const trimmed = shadow.trim()
      const parts = segment(trimmed, " ").filter((p) => p.trim() !== "")
      let color: string | null = null
      let offsetX: string | null = null
      let offsetY: string | null = null
      for (const part of parts) {
        if (["inset", "inherit", "initial", "revert", "unset"].includes(part)) continue
        if (/^-?(\d+|\.\d+)(.*?)$/.test(part)) {
          if (offsetX === null) offsetX = part
          else if (offsetY === null) offsetY = part
        } else if (color === null) color = part
      }
      if (offsetX === null || offsetY === null) return trimmed
      const replacement = fn(color ?? "currentcolor")
      return color !== null ? trimmed.replace(color, replacement) : `${trimmed} ${replacement}`
    })
    .join(", ")
}

function shadowDecls(
  prop: string,
  value: string,
  alpha: string | undefined,
  fn: (color: string) => string,
  prefix = "",
): Array<Node> {
  let needsSupports = false
  const withAlphaValue = replaceShadowColors(value, (color) => {
    if (alpha === undefined) return fn(color)
    if (color.startsWith("current")) return fn(withAlpha(color, alpha))
    if (color.startsWith("var(") || alpha.startsWith("var(")) needsSupports = true
    return fn(withAlphaRelative(color, alpha))
  })
  const addPrefix = (v: string) => (prefix ? segment(v, ",").map((s) => prefix + s).join(",") : v)
  if (needsSupports) {
    return [
      decl(prop, addPrefix(replaceShadowColors(value, fn))),
      rule("@supports (color: lab(from red l a b))", [decl(prop, addPrefix(withAlphaValue))]),
    ]
  }
  return [decl(prop, addPrefix(withAlphaValue))]
}

function dropShadowDecls(
  prop: string,
  value: string,
  alpha: string | undefined,
  fn: (color: string) => string,
): Array<Node> {
  let needsSupports = false
  const converted = segment(value, ",")
    .map((s) =>
      replaceShadowColors(s, (color) => {
        if (alpha === undefined) return fn(color)
        if (color.startsWith("current")) return fn(withAlpha(color, alpha))
        if (color.startsWith("var(") || alpha.startsWith("var(")) needsSupports = true
        return fn(withAlphaRelative(color, alpha))
      })
    )
    .map((s) => `drop-shadow(${s})`)
    .join(" ")
  if (needsSupports) {
    return [
      decl(prop, segment(value, ",").map((s) => `drop-shadow(${replaceShadowColors(s, fn)})`).join(" ")),
      rule("@supports (color: lab(from red l a b))", [decl(prop, converted)]),
    ]
  }
  return [decl(prop, converted)]
}

interface FunctionalOptions {
  themeKeys?: ReadonlyArray<string>
  defaultValue?: string | null
  supportsNegative?: boolean
  supportsFractions?: boolean
  handleBareValue?: (value: NamedValue) => string | null
  handleNegativeBareValue?: (value: NamedValue) => string | null
  staticValues?: Record<string, Array<Node>>
  handle: (value: string, dataType: string | null) => UtilityResult
}

function registerUtilities(design: DesignSystem) {
  const theme = design.theme
  const add = (root: string, utility: Utility) => {
    let list = design.utilities.get(root)
    if (!list) design.utilities.set(root, list = [])
    list.push(utility)
  }
  const staticUtility = (name: string, decls: Array<[string, string] | (() => Node | Array<Node>)>) =>
    add(name, {
      kind: "static",
      compile: () => decls.flatMap((d) => (typeof d === "function" ? d() : decl(d[0], d[1]))),
    })
  const functional = (name: string, fn: (c: FunctionalCandidate) => UtilityResult) =>
    add(name, { kind: "functional", compile: (c) => fn(c as FunctionalCandidate) })

  const functionalUtility = (name: string, options: FunctionalOptions) => {
    const create = (negative: boolean) => (c: FunctionalCandidate): UtilityResult => {
      let value: string | null = null
      let dataType: string | null = null
      if (c.value) {
        if (c.value.kind === "arbitrary") {
          if (c.modifier) return
          value = c.value.value
          dataType = c.value.dataType
        } else {
          value = theme.resolve(c.value.fraction ?? c.value.value, options.themeKeys ?? [])
          if (value === null && options.supportsFractions && c.value.fraction) {
            const [a, b] = segment(c.value.fraction, "/")
            if (!isPositiveInteger(a) || !isPositiveInteger(b)) return
            value = `calc(${c.value.fraction} * 100%)`
          }
          if (value === null && negative && options.handleNegativeBareValue) {
            value = options.handleNegativeBareValue(c.value)
            if (!value?.includes("/") && c.modifier) return
            if (value !== null) return options.handle(value, null)
          }
          if (value === null && options.handleBareValue) {
            value = options.handleBareValue(c.value)
            if (!value?.includes("/") && c.modifier) return
          }
          if (value === null && !negative && options.staticValues && !c.modifier) {
            const nodes = options.staticValues[c.value.value]
            if (nodes) return cloneNodes(nodes)
          }
        }
      } else {
        if (c.modifier) return
        value = options.defaultValue !== undefined ? options.defaultValue : theme.resolve(null, options.themeKeys ?? [])
      }
      if (value === null) return
      return options.handle(negative ? `calc(${value} * -1)` : value, dataType)
    }
    if (options.supportsNegative) functional(`-${name}`, create(true))
    functional(name, create(false))
  }

  const colorUtility = (name: string, keys: ReadonlyArray<string>, handle: (value: string) => Array<Node>) =>
    functional(name, (c) => {
      if (!c.value) return
      const value = c.value.kind === "arbitrary"
        ? applyModifier(c.value.value, c.modifier, theme)
        : resolveColor(c, theme, keys)
      if (value !== null) return handle(value)
    })

  const spacingUtility = (
    name: string,
    themeKeys: ReadonlyArray<string>,
    handle: (value: string) => Array<Node>,
    options: { supportsNegative?: boolean; supportsFractions?: boolean; staticValues?: Record<string, Array<Node>> } =
      {},
  ) => {
    if (options.supportsNegative) staticUtility(`-${name}-px`, [() => handle("-1px")])
    staticUtility(`${name}-px`, [() => handle("1px")])
    functionalUtility(name, {
      themeKeys,
      supportsFractions: options.supportsFractions,
      supportsNegative: options.supportsNegative,
      defaultValue: null,
      handleBareValue: (named) => {
        const spacing = theme.resolve(null, ["--spacing"])
        return !spacing || !isSpacing(named.value) ? null : `calc(${spacing} * ${named.value})`
      },
      handleNegativeBareValue: (named) => {
        const spacing = theme.resolve(null, ["--spacing"])
        return !spacing || !isSpacing(named.value) ? null : `calc(${spacing} * -${named.value})`
      },
      handle,
      staticValues: options.staticValues,
    })
  }

  for (const line of STATIC_UTILITIES.trim().split("\n")) {
    const space = line.indexOf(" ")
    staticUtility(
      line.slice(0, space),
      line.slice(space + 1).split(";").map((d) => [d.slice(0, d.indexOf(":")), d.slice(d.indexOf(":") + 1)]),
    )
  }

  const colorOrWidth = (
    name: string,
    o: {
      colorKeys: ReadonlyArray<string>
      widthKeys: ReadonlyArray<string>
      widthTypes: ReadonlyArray<string>
      color: (value: string) => Array<Node>
      width: (value: string) => Array<Node>
      defaultWidth?: string
      unit?: string
      widthFirst?: boolean
      widthAllowsModifier?: boolean
    },
  ) =>
    functional(name, (c) => {
      if (!c.value) return c.modifier || o.defaultWidth === undefined ? undefined : o.width(o.defaultWidth)
      if (c.value.kind === "arbitrary") {
        const v = c.value.value
        const type = c.value.dataType ?? inferDataType(v, ["color", ...o.widthTypes])
        if (type !== null && o.widthTypes.includes(type)) return c.modifier ? undefined : o.width(v)
        const color = applyModifier(v, c.modifier, theme)
        return color === null ? undefined : o.color(color)
      }
      const named = c.value.value
      const width = theme.resolve(named, o.widthKeys) ?? (isPositiveInteger(named) ? `${named}${o.unit ?? "px"}` : null)
      if (o.widthFirst && width !== null) return c.modifier ? undefined : o.width(width)
      const color = resolveColor(c, theme, o.colorKeys)
      if (color) return o.color(color)
      if (o.widthFirst || width === null || (c.modifier && !o.widthAllowsModifier)) return
      return o.width(width)
    })

  const integer = (named: NamedValue) => (isPositiveInteger(named.value) ? named.value : null)
  const suffix = (unit: string) => (named: NamedValue) =>
    isPositiveInteger(named.value) ? `${named.value}${unit}` : null

  for (const v of "static fixed absolute relative sticky".split(" ")) staticUtility(v, [["position", v]])

  for (
    const [name, prop] of pairs(
      "inset inset;inset-x inset-inline;inset-y inset-block;start inset-inline-start;end inset-inline-end;top top;right right;bottom bottom;left left",
    )
  ) {
    staticUtility(`${name}-auto`, [[prop, "auto"]])
    staticUtility(`${name}-full`, [[prop, "100%"]])
    staticUtility(`-${name}-full`, [[prop, "-100%"]])
    spacingUtility(name, ["--inset", "--spacing"], (v) => [decl(prop, v)], {
      supportsNegative: true,
      supportsFractions: true,
    })
  }

  functionalUtility("z", {
    supportsNegative: true,
    handleBareValue: integer,
    themeKeys: ["--z-index"],
    handle: (v) => [decl("z-index", v)],
    staticValues: { auto: [decl("z-index", "auto")] },
  })
  functionalUtility("order", {
    supportsNegative: true,
    handleBareValue: integer,
    themeKeys: ["--order"],
    handle: (v) => [decl("order", v)],
    staticValues: { first: [decl("order", "-9999")], last: [decl("order", "9999")] },
  })
  for (const [name, prop] of pairs("col grid-column;row grid-row")) {
    functionalUtility(name, {
      supportsNegative: true,
      handleBareValue: integer,
      themeKeys: [`--${prop}`],
      handle: (v) => [decl(prop, v)],
      staticValues: { auto: [decl(prop, "auto")] },
    })
    functionalUtility(`${name}-span`, {
      themeKeys: [],
      handleBareValue: integer,
      handle: (v) => [decl(prop, `span ${v} / span ${v}`)],
      staticValues: { full: [decl(prop, "1 / -1")] },
    })
    for (const edge of "start end".split(" ")) {
      functionalUtility(`${name}-${edge}`, {
        supportsNegative: true,
        handleBareValue: integer,
        themeKeys: [`--${prop}-${edge}`],
        handle: (v) => [decl(`${prop}-${edge}`, v)],
        staticValues: { auto: [decl(`${prop}-${edge}`, "auto")] },
      })
    }
  }
  for (
    const [name, value] of pairs("start inline-start;end inline-end;right right;left left;none none")
  ) {
    staticUtility(`float-${name}`, [["float", value]])
  }
  for (
    const [name, value] of pairs("start inline-start;end inline-end;right right;left left;both both;none none")
  ) {
    staticUtility(`clear-${name}`, [["clear", value]])
  }

  for (
    const [name, prop] of pairs(
      "m margin;mx margin-inline;my margin-block;ms margin-inline-start;me margin-inline-end;mt margin-top;mr margin-right;mb margin-bottom;ml margin-left",
    )
  ) {
    staticUtility(`${name}-auto`, [[prop, "auto"]])
    spacingUtility(name, ["--margin", "--spacing"], (v) => [decl(prop, v)], { supportsNegative: true })
  }

  functionalUtility("line-clamp", {
    themeKeys: ["--line-clamp"],
    handleBareValue: integer,
    handle: (v) => [
      decl("overflow", "hidden"),
      decl("display", "-webkit-box"),
      decl("-webkit-box-orient", "vertical"),
      decl("-webkit-line-clamp", v),
    ],
    staticValues: {
      none: [
        decl("overflow", "visible"),
        decl("display", "block"),
        decl("-webkit-box-orient", "horizontal"),
        decl("-webkit-line-clamp", "unset"),
      ],
    },
  })
  for (
    const [name, value] of pairs(
      "block block;inline-block inline-block;inline inline;hidden none;inline-flex inline-flex;table table;inline-table inline-table;table-caption table-caption;table-cell table-cell;table-column table-column;table-column-group table-column-group;table-footer-group table-footer-group;table-header-group table-header-group;table-row-group table-row-group;table-row table-row;flow-root flow-root;flex flex;grid grid;inline-grid inline-grid;contents contents;list-item list-item",
    )
  ) {
    staticUtility(name, [["display", value]])
  }
  functionalUtility("aspect", {
    themeKeys: ["--aspect"],
    handleBareValue: (named) => {
      if (named.fraction === null) return null
      const [a, b] = segment(named.fraction, "/")
      return !isPositiveInteger(a) || !isPositiveInteger(b) ? null : named.fraction
    },
    handle: (v) => [decl("aspect-ratio", v)],
    staticValues: { auto: [decl("aspect-ratio", "auto")], square: [decl("aspect-ratio", "1 / 1")] },
  })

  for (
    const [name, value] of pairs(
      "full 100%;svw 100svw;lvw 100lvw;dvw 100dvw;svh 100svh;lvh 100lvh;dvh 100dvh;min min-content;max max-content;fit fit-content",
    )
  ) {
    staticUtility(`size-${name}`, [["--tw-sort", "size"], ["width", value], ["height", value]])
    staticUtility(`w-${name}`, [["width", value]])
    staticUtility(`h-${name}`, [["height", value]])
    staticUtility(`min-w-${name}`, [["min-width", value]])
    staticUtility(`min-h-${name}`, [["min-height", value]])
    staticUtility(`max-w-${name}`, [["max-width", value]])
    staticUtility(`max-h-${name}`, [["max-height", value]])
  }
  spacingUtility(
    "size",
    ["--size", "--spacing"],
    (v) => [decl("--tw-sort", "size"), decl("width", v), decl("height", v)],
    {
      supportsFractions: true,
    },
  )
  for (
    const [name, keys, prop] of [
      ["w", ["--width", "--spacing", "--container"], "width"],
      ["min-w", ["--min-width", "--spacing", "--container"], "min-width"],
      ["max-w", ["--max-width", "--spacing", "--container"], "max-width"],
      ["h", ["--height", "--spacing"], "height"],
      ["min-h", ["--min-height", "--height", "--spacing"], "min-height"],
      ["max-h", ["--max-height", "--height", "--spacing"], "max-height"],
    ] as const
  ) {
    spacingUtility(name, keys, (v) => [decl(prop, v)], { supportsFractions: true })
  }

  add("container", {
    kind: "static",
    compile: () => {
      const breakpoints = [...theme.namespace("--breakpoint").values()].sort((a, b) => compareBreakpoints(a, b, "asc"))
      return [
        decl("--tw-sort", "--tw-container-component"),
        decl("width", "100%"),
        ...breakpoints.map((bp) => rule(`@media (width >= ${bp})`, [decl("max-width", bp)])),
      ]
    },
  })

  functional("flex", (c) => {
    if (!c.value) return
    if (c.value.kind === "arbitrary") return c.modifier ? undefined : [decl("flex", c.value.value)]
    if (c.value.fraction) {
      const [a, b] = segment(c.value.fraction, "/")
      return !isPositiveInteger(a) || !isPositiveInteger(b)
        ? undefined
        : [decl("flex", `calc(${c.value.fraction} * 100%)`)]
    }
    if (isPositiveInteger(c.value.value)) return c.modifier ? undefined : [decl("flex", c.value.value)]
  })
  functionalUtility("shrink", { defaultValue: "1", handleBareValue: integer, handle: (v) => [decl("flex-shrink", v)] })
  functionalUtility("grow", { defaultValue: "1", handleBareValue: integer, handle: (v) => [decl("flex-grow", v)] })
  spacingUtility("basis", ["--flex-basis", "--spacing", "--container"], (v) => [decl("flex-basis", v)], {
    supportsFractions: true,
  })
  const borderSpacingProps = () => [
    property("--tw-border-spacing-x", "0", "<length>"),
    property("--tw-border-spacing-y", "0", "<length>"),
  ]
  const borderSpacing = "var(--tw-border-spacing-x) var(--tw-border-spacing-y)"
  spacingUtility("border-spacing", ["--border-spacing", "--spacing"], (v) => [
    ...borderSpacingProps(),
    decl("--tw-border-spacing-x", v),
    decl("--tw-border-spacing-y", v),
    decl("border-spacing", borderSpacing),
  ])
  for (const axis of "x y".split(" ")) {
    spacingUtility(`border-spacing-${axis}`, ["--border-spacing", "--spacing"], (v) => [
      ...borderSpacingProps(),
      decl(`--tw-border-spacing-${axis}`, v),
      decl("border-spacing", borderSpacing),
    ])
  }

  const positions = (prop: string) => ({
    center: [decl(prop, "center")],
    top: [decl(prop, "top")],
    "top-right": [decl(prop, "100% 0")],
    right: [decl(prop, "100%")],
    "bottom-right": [decl(prop, "100% 100%")],
    bottom: [decl(prop, "bottom")],
    "bottom-left": [decl(prop, "0 100%")],
    left: [decl(prop, "0")],
    "top-left": [decl(prop, "0 0")],
  })
  functionalUtility("origin", {
    themeKeys: ["--transform-origin"],
    handle: (v) => [decl("transform-origin", v)],
    staticValues: positions("transform-origin"),
  })
  functionalUtility("perspective-origin", {
    themeKeys: ["--perspective-origin"],
    handle: (v) => [decl("perspective-origin", v)],
    staticValues: positions("perspective-origin"),
  })
  functionalUtility("perspective", {
    themeKeys: ["--perspective"],
    handle: (v) => [decl("perspective", v)],
    staticValues: { none: [decl("perspective", "none")] },
  })

  const translateProps = () => [
    property("--tw-translate-x", "0"),
    property("--tw-translate-y", "0"),
    property("--tw-translate-z", "0"),
  ]
  const translate2d = "var(--tw-translate-x) var(--tw-translate-y)"
  const translate3d = "var(--tw-translate-x) var(--tw-translate-y) var(--tw-translate-z)"
  staticUtility("-translate-full", [
    translateProps,
    ["--tw-translate-x", "-100%"],
    ["--tw-translate-y", "-100%"],
    ["translate", translate2d],
  ])
  staticUtility("translate-full", [
    translateProps,
    ["--tw-translate-x", "100%"],
    ["--tw-translate-y", "100%"],
    ["translate", translate2d],
  ])
  spacingUtility(
    "translate",
    ["--translate", "--spacing"],
    (
      v,
    ) => [
      ...translateProps(),
      decl("--tw-translate-x", v),
      decl("--tw-translate-y", v),
      decl("translate", translate2d),
    ],
    { supportsNegative: true, supportsFractions: true },
  )
  for (const axis of "x y".split(" ")) {
    staticUtility(`-translate-${axis}-full`, [translateProps, [`--tw-translate-${axis}`, "-100%"], [
      "translate",
      translate2d,
    ]])
    staticUtility(`translate-${axis}-full`, [translateProps, [`--tw-translate-${axis}`, "100%"], [
      "translate",
      translate2d,
    ]])
    spacingUtility(
      `translate-${axis}`,
      ["--translate", "--spacing"],
      (v) => [...translateProps(), decl(`--tw-translate-${axis}`, v), decl("translate", translate2d)],
      { supportsNegative: true, supportsFractions: true },
    )
  }
  spacingUtility(
    "translate-z",
    ["--translate", "--spacing"],
    (v) => [...translateProps(), decl("--tw-translate-z", v), decl("translate", translate3d)],
    { supportsNegative: true },
  )
  staticUtility("translate-3d", [translateProps, ["translate", translate3d]])

  const scaleProps = () => [property("--tw-scale-x", "1"), property("--tw-scale-y", "1"), property("--tw-scale-z", "1")]
  const scale = (negative: boolean) => (c: FunctionalCandidate): UtilityResult => {
    if (!c.value || c.modifier) return
    if (c.value.kind === "arbitrary") {
      return [decl("scale", negative ? `calc(${c.value.value} * -1)` : c.value.value)]
    }
    let v = theme.resolve(c.value.value, ["--scale"])
    if (!v && isPositiveInteger(c.value.value)) v = `${c.value.value}%`
    if (!v) return
    v = negative ? `calc(${v} * -1)` : v
    return [
      ...scaleProps(),
      decl("--tw-scale-x", v),
      decl("--tw-scale-y", v),
      decl("--tw-scale-z", v),
      decl("scale", "var(--tw-scale-x) var(--tw-scale-y)"),
    ]
  }
  functional("-scale", scale(true))
  functional("scale", scale(false))
  for (const axis of "x y z".split(" ")) {
    functionalUtility(`scale-${axis}`, {
      supportsNegative: true,
      themeKeys: ["--scale"],
      handleBareValue: suffix("%"),
      handle: (v) => [
        ...scaleProps(),
        decl(`--tw-scale-${axis}`, v),
        decl("scale", `var(--tw-scale-x) var(--tw-scale-y)${axis === "z" ? " var(--tw-scale-z)" : ""}`),
      ],
    })
  }
  staticUtility("scale-3d", [scaleProps, ["scale", "var(--tw-scale-x) var(--tw-scale-y) var(--tw-scale-z)"]])

  const rotate = (negative: boolean) => (c: FunctionalCandidate): UtilityResult => {
    if (!c.value || c.modifier) return
    let v: string | null
    if (c.value.kind === "arbitrary") {
      v = c.value.value
      const type = c.value.dataType ?? inferDataType(v, ["angle", "vector"])
      if (type === "vector") return [decl("rotate", `${v} var(--tw-rotate)`)]
      if (type !== "angle") return [decl("rotate", negative ? `calc(${v} * -1)` : v)]
    } else {
      v = theme.resolve(c.value.value, ["--rotate"])
      if (!v && isPositiveInteger(c.value.value)) v = `${c.value.value}deg`
      if (!v) return
    }
    return [decl("rotate", negative ? `calc(${v} * -1)` : v)]
  }
  functional("-rotate", rotate(true))
  functional("rotate", rotate(false))

  const transformValue =
    "var(--tw-rotate-x,) var(--tw-rotate-y,) var(--tw-rotate-z,) var(--tw-skew-x,) var(--tw-skew-y,)"
  const transformProps = () => [
    property("--tw-rotate-x"),
    property("--tw-rotate-y"),
    property("--tw-rotate-z"),
    property("--tw-skew-x"),
    property("--tw-skew-y"),
  ]
  for (const axis of "x y z".split(" ")) {
    functionalUtility(`rotate-${axis}`, {
      supportsNegative: true,
      themeKeys: ["--rotate"],
      handleBareValue: suffix("deg"),
      handle: (v) => [
        ...transformProps(),
        decl(`--tw-rotate-${axis}`, `rotate${axis.toUpperCase()}(${v})`),
        decl("transform", transformValue),
      ],
    })
  }
  functionalUtility("skew", {
    supportsNegative: true,
    themeKeys: ["--skew"],
    handleBareValue: suffix("deg"),
    handle: (v) => [
      ...transformProps(),
      decl("--tw-skew-x", `skewX(${v})`),
      decl("--tw-skew-y", `skewY(${v})`),
      decl("transform", transformValue),
    ],
  })
  for (const axis of "x y".split(" ")) {
    functionalUtility(`skew-${axis}`, {
      supportsNegative: true,
      themeKeys: ["--skew"],
      handleBareValue: suffix("deg"),
      handle: (v) => [
        ...transformProps(),
        decl(`--tw-skew-${axis}`, `skew${axis.toUpperCase()}(${v})`),
        decl("transform", transformValue),
      ],
    })
  }
  functional("transform", (c) => {
    if (c.modifier) return
    let v: string | null = null
    if (!c.value) v = transformValue
    else if (c.value.kind === "arbitrary") v = c.value.value
    if (v !== null) return [...transformProps(), decl("transform", v)]
  })
  staticUtility("transform-cpu", [["transform", transformValue]])
  staticUtility("transform-gpu", [["transform", `translateZ(0) ${transformValue}`]])
  for (const v of "content border fill stroke view".split(" ")) {
    staticUtility(`transform-${v}`, [["transform-box", `${v}-box`]])
  }
  for (
    const v
      of "auto default pointer wait text move help not-allowed none context-menu progress cell crosshair vertical-text alias copy no-drop grab grabbing all-scroll col-resize row-resize n-resize e-resize s-resize w-resize ne-resize nw-resize se-resize sw-resize ew-resize ns-resize nesw-resize nwse-resize zoom-in zoom-out"
        .split(" ")
  ) {
    staticUtility(`cursor-${v}`, [["cursor", v]])
  }
  functionalUtility("cursor", { themeKeys: ["--cursor"], handle: (v) => [decl("cursor", v)] })

  for (const v of "auto none manipulation".split(" ")) staticUtility(`touch-${v}`, [["touch-action", v]])
  const touchProps = () => [property("--tw-pan-x"), property("--tw-pan-y"), property("--tw-pinch-zoom")]
  const touchValue = "var(--tw-pan-x,) var(--tw-pan-y,) var(--tw-pinch-zoom,)"
  for (const v of "x left right".split(" ")) {
    staticUtility(`touch-pan-${v}`, [touchProps, ["--tw-pan-x", `pan-${v}`], ["touch-action", touchValue]])
  }
  for (const v of "y up down".split(" ")) {
    staticUtility(`touch-pan-${v}`, [touchProps, ["--tw-pan-y", `pan-${v}`], ["touch-action", touchValue]])
  }
  staticUtility("touch-pinch-zoom", [touchProps, ["--tw-pinch-zoom", "pinch-zoom"], ["touch-action", touchValue]])
  for (const v of "none text all auto".split(" ")) {
    staticUtility(`select-${v}`, [["-webkit-user-select", v], ["user-select", v]])
  }
  const snapProps = () => [property("--tw-scroll-snap-strictness", "proximity", "*")]
  for (const v of "x y both".split(" ")) {
    staticUtility(`snap-${v}`, [snapProps, ["scroll-snap-type", `${v} var(--tw-scroll-snap-strictness)`]])
  }
  staticUtility("snap-mandatory", [snapProps, ["--tw-scroll-snap-strictness", "mandatory"]])
  staticUtility("snap-proximity", [snapProps, ["--tw-scroll-snap-strictness", "proximity"]])
  const sides: ReadonlyArray<readonly [string, string]> = [
    ["", ""],
    ...pairs("x -inline;y -block;s -inline-start;e -inline-end;t -top;r -right;b -bottom;l -left"),
  ]
  for (const [side, prop] of sides) {
    spacingUtility(`scroll-m${side}`, ["--scroll-margin", "--spacing"], (v) => [decl(`scroll-margin${prop}`, v)], {
      supportsNegative: true,
    })
  }
  for (const [side, prop] of sides) {
    spacingUtility(`scroll-p${side}`, ["--scroll-padding", "--spacing"], (v) => [decl(`scroll-padding${prop}`, v)])
  }

  functionalUtility("list", {
    themeKeys: ["--list-style-type"],
    handle: (v) => [decl("list-style-type", v)],
    staticValues: {
      none: [decl("list-style-type", "none")],
      disc: [decl("list-style-type", "disc")],
      decimal: [decl("list-style-type", "decimal")],
    },
  })
  functionalUtility("list-image", {
    themeKeys: ["--list-style-image"],
    handle: (v) => [decl("list-style-image", v)],
    staticValues: { none: [decl("list-style-image", "none")] },
  })
  for (
    const [name, value] of pairs(
      "normal normal;dark dark;light light;light-dark light dark;only-dark only dark;only-light only light",
    )
  ) {
    staticUtility(`scheme-${name}`, [["color-scheme", value]])
  }
  functionalUtility("columns", {
    themeKeys: ["--columns", "--container"],
    handleBareValue: integer,
    handle: (v) => [decl("columns", v)],
    staticValues: { auto: [decl("columns", "auto")] },
  })
  for (const v of "auto avoid all avoid-page page left right column".split(" ")) {
    staticUtility(`break-before-${v}`, [["break-before", v]])
  }
  for (const v of "auto avoid avoid-page avoid-column".split(" ")) {
    staticUtility(`break-inside-${v}`, [["break-inside", v]])
  }
  for (const v of "auto avoid all avoid-page page left right column".split(" ")) {
    staticUtility(`break-after-${v}`, [["break-after", v]])
  }
  for (const [name, prop] of pairs("auto-cols grid-auto-columns;auto-rows grid-auto-rows")) {
    functionalUtility(name, {
      themeKeys: [`--${prop}`],
      handle: (v) => [decl(prop, v)],
      staticValues: {
        auto: [decl(prop, "auto")],
        min: [decl(prop, "min-content")],
        max: [decl(prop, "max-content")],
        fr: [decl(prop, "minmax(0, 1fr)")],
      },
    })
  }
  for (const [name, prop] of pairs("grid-cols grid-template-columns;grid-rows grid-template-rows")) {
    functionalUtility(name, {
      themeKeys: [`--${prop}`],
      handleBareValue: (named) =>
        isStrictPositiveInteger(named.value) ? `repeat(${named.value}, minmax(0, 1fr))` : null,
      handle: (v) => [decl(prop, v)],
      staticValues: { none: [decl(prop, "none")], subgrid: [decl(prop, "subgrid")] },
    })
  }
  for (const v of "row row-reverse col col-reverse".split(" ")) {
    staticUtility(`flex-${v}`, [["flex-direction", v.replace("col", "column")]])
  }
  spacingUtility("gap", ["--gap", "--spacing"], (v) => [decl("gap", v)])
  spacingUtility("gap-x", ["--gap", "--spacing"], (v) => [decl("column-gap", v)])
  spacingUtility("gap-y", ["--gap", "--spacing"], (v) => [decl("row-gap", v)])

  const notLast = ":where(& > :not(:last-child))"
  spacingUtility("space-x", ["--space", "--spacing"], (v) => [
    property("--tw-space-x-reverse", "0"),
    rule(notLast, [
      decl("--tw-sort", "row-gap"),
      decl("--tw-space-x-reverse", "0"),
      decl("margin-inline-start", `calc(${v} * var(--tw-space-x-reverse))`),
      decl("margin-inline-end", `calc(${v} * calc(1 - var(--tw-space-x-reverse)))`),
    ]),
  ], { supportsNegative: true })
  spacingUtility("space-y", ["--space", "--spacing"], (v) => [
    property("--tw-space-y-reverse", "0"),
    rule(notLast, [
      decl("--tw-sort", "column-gap"),
      decl("--tw-space-y-reverse", "0"),
      decl("margin-block-start", `calc(${v} * var(--tw-space-y-reverse))`),
      decl("margin-block-end", `calc(${v} * calc(1 - var(--tw-space-y-reverse)))`),
    ]),
  ], { supportsNegative: true })
  staticUtility("space-x-reverse", [
    () => property("--tw-space-x-reverse", "0"),
    () => rule(notLast, [decl("--tw-sort", "row-gap"), decl("--tw-space-x-reverse", "1")]),
  ])
  staticUtility("space-y-reverse", [
    () => property("--tw-space-y-reverse", "0"),
    () => rule(notLast, [decl("--tw-sort", "column-gap"), decl("--tw-space-y-reverse", "1")]),
  ])
  colorUtility("accent", ["--accent-color", "--color"], (v) => [decl("accent-color", v)])
  colorUtility("caret", ["--caret-color", "--color"], (v) => [decl("caret-color", v)])
  colorUtility("divide", ["--divide-color", "--border-color", "--color"], (v) => [
    rule(notLast, [decl("--tw-sort", "divide-color"), decl("border-color", v)]),
  ])
  for (const v of "auto hidden clip visible scroll".split(" ")) {
    staticUtility(`overflow-${v}`, [["overflow", v]])
    staticUtility(`overflow-x-${v}`, [["overflow-x", v]])
    staticUtility(`overflow-y-${v}`, [["overflow-y", v]])
  }
  for (const v of "auto contain none".split(" ")) {
    staticUtility(`overscroll-${v}`, [["overscroll-behavior", v]])
    staticUtility(`overscroll-x-${v}`, [["overscroll-behavior-x", v]])
    staticUtility(`overscroll-y-${v}`, [["overscroll-behavior-y", v]])
  }
  for (const v of "none manual auto".split(" ")) staticUtility(`hyphens-${v}`, [["-webkit-hyphens", v], ["hyphens", v]])
  for (const v of "normal nowrap pre pre-line pre-wrap break-spaces".split(" ")) {
    staticUtility(`whitespace-${v}`, [["white-space", v]])
  }
  for (
    const [name, props] of [
      ["rounded", ["border-radius"]],
      ["rounded-s", ["border-start-start-radius", "border-end-start-radius"]],
      ["rounded-e", ["border-start-end-radius", "border-end-end-radius"]],
      ["rounded-t", ["border-top-left-radius", "border-top-right-radius"]],
      ["rounded-r", ["border-top-right-radius", "border-bottom-right-radius"]],
      ["rounded-b", ["border-bottom-right-radius", "border-bottom-left-radius"]],
      ["rounded-l", ["border-top-left-radius", "border-bottom-left-radius"]],
      ["rounded-ss", ["border-start-start-radius"]],
      ["rounded-se", ["border-start-end-radius"]],
      ["rounded-ee", ["border-end-end-radius"]],
      ["rounded-es", ["border-end-start-radius"]],
      ["rounded-tl", ["border-top-left-radius"]],
      ["rounded-tr", ["border-top-right-radius"]],
      ["rounded-br", ["border-bottom-right-radius"]],
      ["rounded-bl", ["border-bottom-left-radius"]],
    ] as const
  ) {
    functionalUtility(name, {
      themeKeys: ["--radius"],
      handle: (v) => props.map((p) => decl(p, v)),
      staticValues: {
        none: props.map((p) => decl(p, "0")),
        full: props.map((p) => decl(p, "calc(infinity * 1px)")),
      },
    })
  }
  for (const v of "solid dashed dotted double hidden none".split(" ")) {
    staticUtility(`border-${v}`, [["--tw-border-style", v], ["border-style", v]])
  }

  const borderProps = () => property("--tw-border-style", "solid")
  for (
    const [name, prefix] of pairs(
      "border border;border-x border-inline;border-y border-block;border-s border-inline-start;border-e border-inline-end;border-t border-top;border-r border-right;border-b border-bottom;border-l border-left",
    )
  ) {
    colorOrWidth(name, {
      colorKeys: ["--border-color", "--color"],
      widthKeys: ["--border-width"],
      widthTypes: ["line-width", "length"],
      defaultWidth: theme.get(["--default-border-width"]) ?? "1px",
      color: (v) => [decl(`${prefix}-color`, v)],
      width: (v) => [borderProps(), decl(`${prefix}-style`, "var(--tw-border-style)"), decl(`${prefix}-width`, v)],
    })
  }
  functionalUtility("divide-x", {
    defaultValue: theme.get(["--default-border-width"]) ?? "1px",
    themeKeys: ["--divide-width", "--border-width"],
    handleBareValue: suffix("px"),
    handle: (v) => [
      property("--tw-divide-x-reverse", "0"),
      rule(notLast, [
        decl("--tw-sort", "divide-x-width"),
        borderProps(),
        decl("--tw-divide-x-reverse", "0"),
        decl("border-inline-style", "var(--tw-border-style)"),
        decl("border-inline-start-width", `calc(${v} * var(--tw-divide-x-reverse))`),
        decl("border-inline-end-width", `calc(${v} * calc(1 - var(--tw-divide-x-reverse)))`),
      ]),
    ],
  })
  functionalUtility("divide-y", {
    defaultValue: theme.get(["--default-border-width"]) ?? "1px",
    themeKeys: ["--divide-width", "--border-width"],
    handleBareValue: suffix("px"),
    handle: (v) => [
      property("--tw-divide-y-reverse", "0"),
      rule(notLast, [
        decl("--tw-sort", "divide-y-width"),
        borderProps(),
        decl("--tw-divide-y-reverse", "0"),
        decl("border-bottom-style", "var(--tw-border-style)"),
        decl("border-top-style", "var(--tw-border-style)"),
        decl("border-top-width", `calc(${v} * var(--tw-divide-y-reverse))`),
        decl("border-bottom-width", `calc(${v} * calc(1 - var(--tw-divide-y-reverse)))`),
      ]),
    ],
  })
  for (const axis of "x y".split(" ")) {
    staticUtility(`divide-${axis}-reverse`, [
      () => property(`--tw-divide-${axis}-reverse`, "0"),
      () => rule(notLast, [decl(`--tw-divide-${axis}-reverse`, "1")]),
    ])
  }
  for (const v of "solid dashed dotted double none".split(" ")) {
    staticUtility(`divide-${v}`, [
      () => rule(notLast, [decl("--tw-sort", "divide-style"), decl("--tw-border-style", v), decl("border-style", v)]),
    ])
  }

  functionalUtility("bg-size", { handle: (v) => [decl("background-size", v)] })
  for (
    const [name, value] of pairs(
      "top top;top-left left top;top-right right top;bottom bottom;bottom-left left bottom;bottom-right right bottom;left left;right right;center center",
    )
  ) {
    staticUtility(`bg-${name}`, [["background-position", value]])
  }
  functionalUtility("bg-position", { handle: (v) => [decl("background-position", v)] })
  for (
    const [name, value] of pairs(
      "repeat repeat;no-repeat no-repeat;repeat-x repeat-x;repeat-y repeat-y;repeat-round round;repeat-space space",
    )
  ) {
    staticUtility(`bg-${name}`, [["background-repeat", value]])
  }
  const interpolation = (modifier: Modifier | null) => {
    if (modifier?.kind === "named") {
      return ["longer", "shorter", "increasing", "decreasing"].includes(modifier.value)
        ? `in oklch ${modifier.value} hue`
        : `in ${modifier.value}`
    }
    return modifier?.kind === "arbitrary" ? modifier.value : "in oklab"
  }
  const linearDirections = new Map(
    pairs(
      "to-t to top;to-tr to top right;to-r to right;to-br to bottom right;to-b to bottom;to-bl to bottom left;to-l to left;to-tl to top left",
    ),
  )
  const linear = (negative: boolean) => (c: FunctionalCandidate): UtilityResult => {
    if (!c.value) return
    if (c.value.kind === "arbitrary") {
      if (c.modifier) return
      let v = c.value.value
      if ((c.value.dataType ?? inferDataType(v, ["angle"])) === "angle") {
        v = negative ? `calc(${v} * -1)` : v
        return [
          decl("--tw-gradient-position", v),
          decl("background-image", `linear-gradient(var(--tw-gradient-stops,${v}))`),
        ]
      }
      if (negative) return
      return [
        decl("--tw-gradient-position", v),
        decl("background-image", `linear-gradient(var(--tw-gradient-stops,${v}))`),
      ]
    }
    let v = c.value.value
    if (!negative && linearDirections.has(v)) v = linearDirections.get(v)!
    else if (isPositiveInteger(v)) v = negative ? `calc(${v}deg * -1)` : `${v}deg`
    else return
    return [
      decl("--tw-gradient-position", v),
      rule("@supports (background-image: linear-gradient(in lab, red, red))", [
        decl("--tw-gradient-position", `${v} ${interpolation(c.modifier)}`),
      ]),
      decl("background-image", "linear-gradient(var(--tw-gradient-stops))"),
    ]
  }
  functional("-bg-linear", linear(true))
  functional("bg-linear", linear(false))
  const conic = (negative: boolean) => (c: FunctionalCandidate): UtilityResult => {
    if (c.value?.kind === "arbitrary") {
      if (c.modifier) return
      const v = c.value.value
      return [
        decl("--tw-gradient-position", v),
        decl("background-image", `conic-gradient(var(--tw-gradient-stops,${v}))`),
      ]
    }
    const interp = interpolation(c.modifier)
    if (!c.value) {
      return [
        decl("--tw-gradient-position", interp),
        decl("background-image", "conic-gradient(var(--tw-gradient-stops))"),
      ]
    }
    let v = c.value.value
    if (!isPositiveInteger(v)) return
    v = negative ? `calc(${v}deg * -1)` : `${v}deg`
    return [
      decl("--tw-gradient-position", `from ${v} ${interp}`),
      decl("background-image", "conic-gradient(var(--tw-gradient-stops))"),
    ]
  }
  functional("-bg-conic", conic(true))
  functional("bg-conic", conic(false))
  functional("bg-radial", (c) => {
    if (!c.value) {
      return [
        decl("--tw-gradient-position", interpolation(c.modifier)),
        decl("background-image", "radial-gradient(var(--tw-gradient-stops))"),
      ]
    }
    if (c.value.kind === "arbitrary") {
      if (c.modifier) return
      const v = c.value.value
      return [
        decl("--tw-gradient-position", v),
        decl("background-image", `radial-gradient(var(--tw-gradient-stops,${v}))`),
      ]
    }
  })
  functional("bg", (c) => {
    if (!c.value) return
    if (c.value.kind === "arbitrary") {
      const v = c.value.value
      switch (
        c.value.dataType ?? inferDataType(v, ["image", "color", "percentage", "position", "bg-size", "length", "url"])
      ) {
        case "percentage":
        case "position":
          return c.modifier ? undefined : [decl("background-position", v)]
        case "bg-size":
        case "length":
        case "size":
          return c.modifier ? undefined : [decl("background-size", v)]
        case "image":
        case "url":
          return c.modifier ? undefined : [decl("background-image", v)]
        default: {
          const value = applyModifier(v, c.modifier, theme)
          return value === null ? undefined : [decl("background-color", value)]
        }
      }
    }
    const color = resolveColor(c, theme, ["--background-color", "--color"])
    if (color) return [decl("background-color", color)]
    if (c.modifier) return
    const image = theme.resolve(c.value.value, ["--background-image"])
    if (image) return [decl("background-image", image)]
  })

  const gradientProps = () => [
    property("--tw-gradient-position"),
    property("--tw-gradient-from", "#0000", "<color>"),
    property("--tw-gradient-via", "#0000", "<color>"),
    property("--tw-gradient-to", "#0000", "<color>"),
    property("--tw-gradient-stops"),
    property("--tw-gradient-via-stops"),
    property("--tw-gradient-from-position", "0%", "<length-percentage>"),
    property("--tw-gradient-via-position", "50%", "<length-percentage>"),
    property("--tw-gradient-to-position", "100%", "<length-percentage>"),
  ]
  const gradientStop = (
    name: string,
    handlers: { color: (v: string) => Array<Node>; position: (v: string) => Array<Node> },
  ) =>
    functional(name, (c) => {
      if (!c.value) return
      if (c.value.kind === "arbitrary") {
        const v = c.value.value
        switch (c.value.dataType ?? inferDataType(v, ["color", "length", "percentage"])) {
          case "length":
          case "percentage":
            return c.modifier ? undefined : handlers.position(v)
          default: {
            const value = applyModifier(v, c.modifier, theme)
            return value === null ? undefined : handlers.color(value)
          }
        }
      }
      const color = resolveColor(c, theme, ["--background-color", "--color"])
      if (color) return handlers.color(color)
      if (c.modifier) return
      const position = theme.resolve(c.value.value, ["--gradient-color-stop-positions"])
      if (position) return handlers.position(position)
      const v = c.value.value
      if (v[v.length - 1] === "%" && isPositiveInteger(v.slice(0, -1))) return handlers.position(v)
    })
  const stops =
    "var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))"
  gradientStop("from", {
    color: (v) => [
      ...gradientProps(),
      decl("--tw-sort", "--tw-gradient-from"),
      decl("--tw-gradient-from", v),
      decl("--tw-gradient-stops", stops),
    ],
    position: (v) => [...gradientProps(), decl("--tw-gradient-from-position", v)],
  })
  gradientStop("via", {
    color: (v) => [
      ...gradientProps(),
      decl("--tw-sort", "--tw-gradient-via"),
      decl("--tw-gradient-via", v),
      decl(
        "--tw-gradient-via-stops",
        "var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-via) var(--tw-gradient-via-position), var(--tw-gradient-to) var(--tw-gradient-to-position)",
      ),
      decl("--tw-gradient-stops", "var(--tw-gradient-via-stops)"),
    ],
    position: (v) => [...gradientProps(), decl("--tw-gradient-via-position", v)],
  })
  gradientStop("to", {
    color: (v) => [
      ...gradientProps(),
      decl("--tw-sort", "--tw-gradient-to"),
      decl("--tw-gradient-to", v),
      decl("--tw-gradient-stops", stops),
    ],
    position: (v) => [...gradientProps(), decl("--tw-gradient-to-position", v)],
  })

  functional("mask", (c) => {
    if (!c.value || c.modifier || c.value.kind !== "arbitrary") return
    const v = c.value.value
    switch (c.value.dataType ?? inferDataType(v, ["image", "percentage", "position", "bg-size", "length", "url"])) {
      case "percentage":
      case "position":
        return [decl("mask-position", v)]
      case "bg-size":
      case "length":
      case "size":
        return [decl("mask-size", v)]
      default:
        return [decl("mask-image", v)]
    }
  })
  for (const v of "add subtract intersect exclude".split(" ")) staticUtility(`mask-${v}`, [["mask-composite", v]])
  for (const v of "auto cover contain".split(" ")) staticUtility(`mask-${v}`, [["mask-size", v]])
  functionalUtility("mask-size", { handle: (v) => [decl("mask-size", v)] })
  for (
    const [name, value] of pairs(
      "top top;top-left left top;top-right right top;bottom bottom;bottom-left left bottom;bottom-right right bottom;left left;right right;center center",
    )
  ) {
    staticUtility(`mask-${name}`, [["mask-position", value]])
  }
  functionalUtility("mask-position", { handle: (v) => [decl("mask-position", v)] })
  for (
    const [name, value] of pairs(
      "repeat repeat;no-repeat no-repeat;repeat-x repeat-x;repeat-y repeat-y;repeat-round round;repeat-space space",
    )
  ) {
    staticUtility(`mask-${name}`, [["mask-repeat", value]])
  }
  for (const v of "border padding content fill stroke view".split(" ")) {
    staticUtility(`mask-clip-${v}`, [["mask-clip", `${v}-box`]])
    staticUtility(`mask-origin-${v}`, [["mask-origin", `${v}-box`]])
  }
  const maskWhite = "linear-gradient(#fff, #fff)"
  const maskProps = () => [
    property("--tw-mask-linear", maskWhite),
    property("--tw-mask-radial", maskWhite),
    property("--tw-mask-conic", maskWhite),
  ]
  const maskImage = () => [
    ...maskProps(),
    decl("mask-image", "var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)"),
    decl("mask-composite", "intersect"),
  ]
  const maskStop = (
    name: string,
    handlers: { color: (v: string) => Array<Node>; position: (v: string) => Array<Node> },
  ) =>
    functional(name, (c) => {
      if (!c.value) return
      if (c.value.kind === "arbitrary") {
        const v = c.value.value
        switch (c.value.dataType ?? inferDataType(v, ["length", "percentage", "color"])) {
          case "color": {
            const value = applyModifier(v, c.modifier, theme)
            return value === null ? undefined : handlers.color(value)
          }
          case "percentage":
            return c.modifier || !isPositiveInteger(v.slice(0, -1)) ? undefined : handlers.position(v)
          default:
            return c.modifier ? undefined : handlers.position(v)
        }
      }
      const color = resolveColor(c, theme, ["--background-color", "--color"])
      if (color) return handlers.color(color)
      if (c.modifier) return
      const v = c.value.value
      switch (inferDataType(v, ["number", "percentage"])) {
        case "number": {
          const spacing = theme.resolve(null, ["--spacing"])
          return !spacing || !isSpacing(v) ? undefined : handlers.position(`calc(${spacing} * ${v})`)
        }
        case "percentage":
          return isPositiveInteger(v.slice(0, -1)) ? handlers.position(v) : undefined
      }
    })
  const edgeProps = () => ["left", "right", "bottom", "top"].map((edge) => property(`--tw-mask-${edge}`, maskWhite))
  for (
    const [axis, edges] of [
      ["x", ["right", "left"]],
      ["y", ["top", "bottom"]],
      ["t", ["top"]],
      ["r", ["right"]],
      ["b", ["bottom"]],
      ["l", ["left"]],
    ] as const
  ) {
    for (const stop of "from to".split(" ")) {
      const handler = (kind: "color" | "position") => (v: string) => {
        const nodes: Array<Node> = [
          ...maskImage(),
          ...edgeProps(),
          decl(
            "--tw-mask-linear",
            "var(--tw-mask-left), var(--tw-mask-right), var(--tw-mask-bottom), var(--tw-mask-top)",
          ),
        ]
        for (const edge of "top right bottom left".split(" ")) {
          if (!(edges as ReadonlyArray<string>).includes(edge)) continue
          nodes.push(
            decl(
              `--tw-mask-${edge}`,
              `linear-gradient(to ${edge}, var(--tw-mask-${edge}-from-color) var(--tw-mask-${edge}-from-position), var(--tw-mask-${edge}-to-color) var(--tw-mask-${edge}-to-position))`,
            ),
            property(`--tw-mask-${edge}-from-position`, "0%"),
            property(`--tw-mask-${edge}-to-position`, "100%"),
            property(`--tw-mask-${edge}-from-color`, "black"),
            property(`--tw-mask-${edge}-to-color`, "transparent"),
            decl(`--tw-mask-${edge}-${stop}-${kind}`, v),
          )
        }
        return nodes
      }
      maskStop(`mask-${axis}-${stop}`, { color: handler("color"), position: handler("position") })
    }
  }
  for (
    const [shape, gradient, stopsValue, hasPosition] of [
      [
        "linear",
        "linear-gradient",
        "var(--tw-mask-linear-position), var(--tw-mask-linear-from-color) var(--tw-mask-linear-from-position), var(--tw-mask-linear-to-color) var(--tw-mask-linear-to-position)",
        true,
      ],
      [
        "radial",
        "radial-gradient",
        "var(--tw-mask-radial-shape) var(--tw-mask-radial-size) at var(--tw-mask-radial-position), var(--tw-mask-radial-from-color) var(--tw-mask-radial-from-position), var(--tw-mask-radial-to-color) var(--tw-mask-radial-to-position)",
        false,
      ],
      [
        "conic",
        "conic-gradient",
        "from var(--tw-mask-conic-position), var(--tw-mask-conic-from-color) var(--tw-mask-conic-from-position), var(--tw-mask-conic-to-color) var(--tw-mask-conic-to-position)",
        true,
      ],
    ] as const
  ) {
    const props = (): Array<Node> => [
      ...(hasPosition ? [property(`--tw-mask-${shape}-position`, "0deg")] : []),
      property(`--tw-mask-${shape}-from-position`, "0%"),
      property(`--tw-mask-${shape}-to-position`, "100%"),
      property(`--tw-mask-${shape}-from-color`, "black"),
      property(`--tw-mask-${shape}-to-color`, "transparent"),
      ...(shape === "radial"
        ? [
          property("--tw-mask-radial-shape", "ellipse"),
          property("--tw-mask-radial-size", "farthest-corner"),
          property("--tw-mask-radial-position", "center"),
        ]
        : []),
    ]
    const base = () => [...maskProps(), ...props(), ...maskImage().slice(3)]
    if (shape === "radial") {
      functionalUtility("mask-radial", {
        defaultValue: null,
        handle: (v) => [
          ...base(),
          decl("--tw-mask-radial", "radial-gradient(var(--tw-mask-radial-stops, var(--tw-mask-radial-size)))"),
          decl("--tw-mask-radial-size", v),
        ],
      })
    } else {
      functionalUtility(`mask-${shape}`, {
        defaultValue: null,
        supportsNegative: true,
        handleBareValue: (named) => (isPositiveInteger(named.value) ? `calc(1deg * ${named.value})` : null),
        handleNegativeBareValue: (named) => (isPositiveInteger(named.value) ? `calc(1deg * -${named.value})` : null),
        handle: (v) => [
          ...base(),
          decl(`--tw-mask-${shape}`, `${gradient}(var(--tw-mask-${shape}-stops, var(--tw-mask-${shape}-position)))`),
          decl(`--tw-mask-${shape}-position`, v),
        ],
      })
    }
    for (const stop of "from to".split(" ")) {
      const handler = (kind: "color" | "position") => (v: string): Array<Node> => [
        ...base(),
        decl(`--tw-mask-${shape}-stops`, stopsValue),
        decl(`--tw-mask-${shape}`, `${gradient}(var(--tw-mask-${shape}-stops))`),
        decl(`--tw-mask-${shape}-${stop}-${kind}`, v),
      ]
      maskStop(`mask-${shape}-${stop}`, { color: handler("color"), position: handler("position") })
    }
    if (shape === "radial") {
      for (const v of "closest-side farthest-side closest-corner farthest-corner".split(" ")) {
        staticUtility(`mask-radial-${v}`, [["--tw-mask-radial-size", v]])
      }
      for (
        const v of "top top-left top-right bottom bottom-left bottom-right left right center".split(" ")
      ) {
        staticUtility(`mask-radial-at-${v}`, [["--tw-mask-radial-position", v.replace("-", " ")]])
      }
      functionalUtility("mask-radial-at", { defaultValue: null, handle: (v) => [decl("--tw-mask-radial-position", v)] })
    }
  }
  for (const v of "border padding content".split(" ")) {
    staticUtility(`bg-clip-${v}`, [["background-clip", `${v}-box`]])
    staticUtility(`bg-origin-${v}`, [["background-origin", `${v}-box`]])
  }
  for (
    const v
      of "normal multiply screen overlay darken lighten color-dodge color-burn hard-light soft-light difference exclusion hue saturation color luminosity"
        .split(" ")
  ) {
    staticUtility(`bg-blend-${v}`, [["background-blend-mode", v]])
    staticUtility(`mix-blend-${v}`, [["mix-blend-mode", v]])
  }
  functional("fill", (c) => {
    if (!c.value) return
    if (c.value.kind === "arbitrary") {
      const v = applyModifier(c.value.value, c.modifier, theme)
      return v === null ? undefined : [decl("fill", v)]
    }
    const color = resolveColor(c, theme, ["--fill", "--color"])
    if (color) return [decl("fill", color)]
  })
  colorOrWidth("stroke", {
    colorKeys: ["--stroke", "--color"],
    widthKeys: ["--stroke-width"],
    widthTypes: ["number", "length", "percentage"],
    unit: "",
    widthAllowsModifier: true,
    color: (v) => [decl("stroke", v)],
    width: (v) => [decl("stroke-width", v)],
  })
  for (const v of "contain cover fill none scale-down".split(" ")) staticUtility(`object-${v}`, [["object-fit", v]])
  functionalUtility("object", {
    themeKeys: ["--object-position"],
    handle: (v) => [decl("object-position", v)],
    staticValues: {
      top: [decl("object-position", "top")],
      "top-left": [decl("object-position", "left top")],
      "top-right": [decl("object-position", "right top")],
      bottom: [decl("object-position", "bottom")],
      "bottom-left": [decl("object-position", "left bottom")],
      "bottom-right": [decl("object-position", "right bottom")],
      left: [decl("object-position", "left")],
      right: [decl("object-position", "right")],
      center: [decl("object-position", "center")],
    },
  })
  for (const [side, prop] of sides) {
    spacingUtility(`p${side}`, ["--padding", "--spacing"], (v) => [decl(`padding${prop}`, v)])
  }
  for (const v of "left center right justify start end".split(" ")) {
    staticUtility(`text-${v}`, [["text-align", v]])
  }
  spacingUtility("indent", ["--text-indent", "--spacing"], (v) => [decl("text-indent", v)], { supportsNegative: true })
  for (const v of "baseline top middle bottom text-top text-bottom sub super".split(" ")) {
    staticUtility(`align-${v}`, [["vertical-align", v]])
  }
  functionalUtility("align", { themeKeys: [], handle: (v) => [decl("vertical-align", v)] })

  const fontWeightProps = () => property("--tw-font-weight")
  functional("font", (c) => {
    if (!c.value || c.modifier) return
    if (c.value.kind === "arbitrary") {
      const v = c.value.value
      switch (c.value.dataType ?? inferDataType(v, ["number", "generic-name", "family-name"])) {
        case "generic-name":
        case "family-name":
          return [decl("font-family", v)]
        default:
          return [fontWeightProps(), decl("--tw-font-weight", v), decl("font-weight", v)]
      }
    }
    const family = theme.resolveWith(c.value.value, ["--font"], [
      "--font-feature-settings",
      "--font-variation-settings",
    ])
    if (family) {
      const [v, extra] = family
      return [
        decl("font-family", v),
        decl("font-feature-settings", extra["--font-feature-settings"]),
        decl("font-variation-settings", extra["--font-variation-settings"]),
      ]
    }
    const weight = theme.resolve(c.value.value, ["--font-weight"])
    if (weight) return [fontWeightProps(), decl("--tw-font-weight", weight), decl("font-weight", weight)]
  })
  for (
    const v
      of "normal ultra-condensed extra-condensed condensed semi-condensed semi-expanded expanded extra-expanded ultra-expanded"
        .split(" ")
  ) {
    staticUtility(`font-stretch-${v}`, [["font-stretch", v]])
  }
  functionalUtility("font-stretch", {
    handleBareValue: (named) => {
      if (!named.value.endsWith("%")) return null
      const n = Number(named.value.slice(0, -1))
      return !isPositiveInteger(n) || Number.isNaN(n) || n < 50 || n > 200 ? null : named.value
    },
    handle: (v) => [decl("font-stretch", v)],
  })
  colorUtility("placeholder", ["--background-color", "--color"], (v) => [
    rule("&::placeholder", [decl("--tw-sort", "placeholder-color"), decl("color", v)]),
  ])
  for (const v of "solid double dotted dashed wavy".split(" ")) {
    staticUtility(`decoration-${v}`, [["text-decoration-style", v]])
  }
  colorOrWidth("decoration", {
    colorKeys: ["--text-decoration-color", "--color"],
    widthKeys: ["--text-decoration-thickness"],
    widthTypes: ["length", "percentage"],
    widthFirst: true,
    color: (v) => [decl("text-decoration-color", v)],
    width: (v) => [decl("text-decoration-thickness", v)],
  })
  functionalUtility("animate", {
    themeKeys: ["--animate"],
    handle: (v) => [decl("animation", v)],
    staticValues: { none: [decl("animation", "none")] },
  })

  const filterValue = "blur brightness contrast grayscale hue-rotate invert saturate sepia drop-shadow"
    .split(" ")
    .map((n) => `var(--tw-${n},)`)
    .join(" ")
  const backdropNames = "blur brightness contrast grayscale hue-rotate invert opacity saturate sepia".split(" ")
  const backdropValue = backdropNames.map((n) => `var(--tw-backdrop-${n},)`).join(" ")
  const filterProps = () => [
    ..."blur brightness contrast grayscale hue-rotate invert opacity saturate sepia drop-shadow drop-shadow-color"
      .split(" ")
      .map((n) => property(`--tw-${n}`)),
    property("--tw-drop-shadow-alpha", "100%", "<percentage>"),
    property("--tw-drop-shadow-size"),
  ]
  const backdropProps = () => backdropNames.map((n) => property(`--tw-backdrop-${n}`))
  const backdrop = () => [decl("-webkit-backdrop-filter", backdropValue), decl("backdrop-filter", backdropValue)]
  functional("filter", (c) => {
    if (c.modifier) return
    if (c.value === null) return [...filterProps(), decl("filter", filterValue)]
    if (c.value.kind === "arbitrary") return [decl("filter", c.value.value)]
    if (c.value.value === "none") return [decl("filter", "none")]
  })
  functional("backdrop-filter", (c) => {
    if (c.modifier) return
    if (c.value === null) return [...backdropProps(), ...backdrop()]
    if (c.value.kind === "arbitrary") {
      return [decl("-webkit-backdrop-filter", c.value.value), decl("backdrop-filter", c.value.value)]
    }
    if (c.value.value === "none") return [decl("-webkit-backdrop-filter", "none"), decl("backdrop-filter", "none")]
  })
  functionalUtility("blur", {
    themeKeys: ["--blur"],
    handle: (v) => [...filterProps(), decl("--tw-blur", `blur(${v})`), decl("filter", filterValue)],
    staticValues: { none: [...filterProps(), decl("--tw-blur", " "), decl("filter", filterValue)] },
  })
  functionalUtility("backdrop-blur", {
    themeKeys: ["--backdrop-blur", "--blur"],
    handle: (v) => [...backdropProps(), decl("--tw-backdrop-blur", `blur(${v})`), ...backdrop()],
    staticValues: { none: [...backdropProps(), decl("--tw-backdrop-blur", " "), ...backdrop()] },
  })
  for (
    const [name, unit, defaultValue, negative] of [
      ["brightness", "%", undefined, false],
      ["contrast", "%", undefined, false],
      ["grayscale", "%", "100%", false],
      ["hue-rotate", "deg", undefined, true],
      ["invert", "%", "100%", false],
      ["saturate", "%", undefined, false],
      ["sepia", "%", "100%", false],
    ] as const
  ) {
    functionalUtility(name, {
      themeKeys: [`--${name}`],
      supportsNegative: negative,
      handleBareValue: suffix(unit),
      defaultValue,
      handle: (v) => [...filterProps(), decl(`--tw-${name}`, `${name}(${v})`), decl("filter", filterValue)],
    })
    functionalUtility(`backdrop-${name}`, {
      themeKeys: [`--backdrop-${name}`, `--${name}`],
      supportsNegative: negative,
      handleBareValue: suffix(unit),
      defaultValue,
      handle: (v) => [...backdropProps(), decl(`--tw-backdrop-${name}`, `${name}(${v})`), ...backdrop()],
    })
  }
  staticUtility("drop-shadow-none", [filterProps, ["--tw-drop-shadow", " "], ["filter", filterValue]])
  functional("drop-shadow", (c) => {
    const alpha = alphaOf(c)
    const withSize = (shadow: string, value: string) => [
      ...filterProps(),
      decl("--tw-drop-shadow-alpha", alpha),
      ...dropShadowDecls("--tw-drop-shadow-size", shadow, alpha, (color) => `var(--tw-drop-shadow-color, ${color})`),
      decl("--tw-drop-shadow", value),
      decl("filter", filterValue),
    ]
    const withColor = (color: string) => [
      ...filterProps(),
      decl("--tw-drop-shadow-color", color),
      decl("--tw-drop-shadow", "var(--tw-drop-shadow-size)"),
    ]
    const dropShadows = (value: string) => segment(value, ",").map((s) => `drop-shadow(${s})`).join(" ")
    if (!c.value) {
      const raw = theme.get(["--drop-shadow"])
      const resolved = theme.resolve(null, ["--drop-shadow"])
      return raw === null || resolved === null ? undefined : withSize(raw, dropShadows(resolved))
    }
    if (c.value.kind === "arbitrary") {
      const v = c.value.value
      if ((c.value.dataType ?? inferDataType(v, ["color"])) === "color") {
        const color = applyModifier(v, c.modifier, theme)
        return color === null ? undefined : withColor(withAlpha(color, "var(--tw-drop-shadow-alpha)"))
      }
      return c.modifier && !alpha ? undefined : withSize(v, "var(--tw-drop-shadow-size)")
    }
    const raw = theme.get([`--drop-shadow-${c.value.value}`])
    const resolved = theme.resolve(c.value.value, ["--drop-shadow"])
    if (raw && resolved) {
      if (c.modifier && !alpha) return
      return withSize(raw, alpha ? "var(--tw-drop-shadow-size)" : dropShadows(resolved))
    }
    const color = resolveColor(c, theme, ["--drop-shadow-color", "--color"])
    if (color) return withColor(color === "inherit" ? "inherit" : withAlpha(color, "var(--tw-drop-shadow-alpha)"))
  })
  functionalUtility("backdrop-opacity", {
    themeKeys: ["--backdrop-opacity", "--opacity"],
    handleBareValue: (named) => (isSpacing(named.value) ? `${named.value}%` : null),
    handle: (v) => [...backdropProps(), decl("--tw-backdrop-opacity", `opacity(${v})`), ...backdrop()],
  })

  const ease = `var(--tw-ease, ${theme.resolve(null, ["--default-transition-timing-function"]) ?? "ease"})`
  const duration = `var(--tw-duration, ${theme.resolve(null, ["--default-transition-duration"]) ?? "0s"})`
  const transition = (prop: string) => [
    decl("transition-property", prop),
    decl("transition-timing-function", ease),
    decl("transition-duration", duration),
  ]
  const colors =
    "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to"
  functionalUtility("transition", {
    defaultValue:
      `${colors}, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events`,
    themeKeys: ["--transition-property"],
    handle: (v) => transition(v),
    staticValues: {
      none: [decl("transition-property", "none")],
      all: transition("all"),
      colors: transition(colors),
      opacity: transition("opacity"),
      shadow: transition("box-shadow"),
      transform: transition("transform, translate, scale, rotate"),
    },
  })
  functionalUtility("delay", {
    handleBareValue: suffix("ms"),
    themeKeys: ["--transition-delay"],
    handle: (v) => [decl("transition-delay", v)],
  })
  const durationProps = () => property("--tw-duration")
  staticUtility("duration-initial", [durationProps, ["--tw-duration", "initial"]])
  functional("duration", (c) => {
    if (c.modifier || !c.value) return
    let v: string | null
    if (c.value.kind === "arbitrary") v = c.value.value
    else {
      v = theme.resolve(c.value.fraction ?? c.value.value, ["--transition-duration"])
      if (v === null && isPositiveInteger(c.value.value)) v = `${c.value.value}ms`
    }
    if (v !== null) return [durationProps(), decl("--tw-duration", v), decl("transition-duration", v)]
  })
  const easeProps = () => property("--tw-ease")
  functionalUtility("ease", {
    themeKeys: ["--ease"],
    handle: (v) => [easeProps(), decl("--tw-ease", v), decl("transition-timing-function", v)],
    staticValues: {
      initial: [easeProps(), decl("--tw-ease", "initial")],
      linear: [easeProps(), decl("--tw-ease", "linear"), decl("transition-timing-function", "linear")],
    },
  })
  functionalUtility("will-change", { themeKeys: [], handle: (v) => [decl("will-change", v)] })
  functionalUtility("content", {
    themeKeys: ["--content"],
    handle: (v) => [property("--tw-content", "\"\""), decl("--tw-content", v), decl("content", "var(--tw-content)")],
  })

  const containValue =
    "var(--tw-contain-size,) var(--tw-contain-layout,) var(--tw-contain-paint,) var(--tw-contain-style,)"
  const containProps = () => ["size", "layout", "paint", "style"].map((n) => property(`--tw-contain-${n}`))
  staticUtility("contain-size", [containProps, ["--tw-contain-size", "size"], ["contain", containValue]])
  staticUtility("contain-inline-size", [containProps, ["--tw-contain-size", "inline-size"], ["contain", containValue]])
  staticUtility("contain-layout", [containProps, ["--tw-contain-layout", "layout"], ["contain", containValue]])
  staticUtility("contain-paint", [containProps, ["--tw-contain-paint", "paint"], ["contain", containValue]])
  staticUtility("contain-style", [containProps, ["--tw-contain-style", "style"], ["contain", containValue]])
  functionalUtility("contain", { themeKeys: [], handle: (v) => [decl("contain", v)] })
  spacingUtility(
    "leading",
    ["--leading", "--spacing"],
    (v) => [property("--tw-leading"), decl("--tw-leading", v), decl("line-height", v)],
    { staticValues: { none: [property("--tw-leading"), decl("--tw-leading", "1"), decl("line-height", "1")] } },
  )
  functionalUtility("tracking", {
    supportsNegative: true,
    themeKeys: ["--tracking"],
    handle: (v) => [property("--tw-tracking"), decl("--tw-tracking", v), decl("letter-spacing", v)],
  })
  const numericValue =
    "var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)"
  const numericProps = () =>
    ["ordinal", "slashed-zero", "numeric-figure", "numeric-spacing", "numeric-fraction"].map((n) =>
      property(`--tw-${n}`)
    )
  for (
    const [name, prop] of pairs(
      "ordinal ordinal;slashed-zero slashed-zero;lining-nums numeric-figure;oldstyle-nums numeric-figure;proportional-nums numeric-spacing;tabular-nums numeric-spacing;diagonal-fractions numeric-fraction;stacked-fractions numeric-fraction",
    )
  ) {
    staticUtility(name, [numericProps, [`--tw-${prop}`, name], ["font-variant-numeric", numericValue]])
  }

  const outlineProps = () => property("--tw-outline-style", "solid")
  add("outline-hidden", {
    kind: "static",
    compile: () => [
      decl("--tw-outline-style", "none"),
      decl("outline-style", "none"),
      rule("@media (forced-colors: active)", [decl("outline", "2px solid transparent"), decl("outline-offset", "2px")]),
    ],
  })
  for (const v of "none solid dashed dotted double".split(" ")) {
    staticUtility(`outline-${v}`, [["--tw-outline-style", v], ["outline-style", v]])
  }
  const outlineWidth = (
    v: string,
  ) => [outlineProps(), decl("outline-style", "var(--tw-outline-style)"), decl("outline-width", v)]
  colorOrWidth("outline", {
    colorKeys: ["--outline-color", "--color"],
    widthKeys: ["--outline-width"],
    widthTypes: ["length", "number", "percentage"],
    defaultWidth: theme.get(["--default-outline-width"]) ?? "1px",
    color: (v) => [decl("outline-color", v)],
    width: outlineWidth,
  })
  functionalUtility("outline-offset", {
    supportsNegative: true,
    themeKeys: ["--outline-offset"],
    handleBareValue: suffix("px"),
    handle: (v) => [decl("outline-offset", v)],
  })
  functionalUtility("opacity", {
    themeKeys: ["--opacity"],
    handleBareValue: (named) => (isSpacing(named.value) ? `${named.value}%` : null),
    handle: (v) => [decl("opacity", v)],
  })
  functionalUtility("underline-offset", {
    supportsNegative: true,
    themeKeys: ["--text-underline-offset"],
    handleBareValue: suffix("px"),
    handle: (v) => [decl("text-underline-offset", v)],
    staticValues: { auto: [decl("text-underline-offset", "auto")] },
  })

  const lineHeight = (modifier: Modifier): string | null => {
    let v = modifier.kind === "arbitrary" ? modifier.value : theme.resolve(modifier.value, ["--leading"])
    if (!v && isSpacing(modifier.value)) {
      const spacing = theme.resolve(null, ["--spacing"])
      if (!spacing) return null
      v = `calc(${spacing} * ${modifier.value})`
    }
    if (!v && modifier.value === "none") v = "1"
    return v
  }
  functional("text", (c) => {
    if (!c.value) return
    if (c.value.kind === "arbitrary") {
      const v = c.value.value
      switch (
        c.value.dataType ?? inferDataType(v, ["color", "length", "percentage", "absolute-size", "relative-size"])
      ) {
        case "size":
        case "length":
        case "percentage":
        case "absolute-size":
        case "relative-size": {
          if (c.modifier) {
            const lh = lineHeight(c.modifier)
            return lh ? [decl("font-size", v), decl("line-height", lh)] : null
          }
          return [decl("font-size", v)]
        }
        default: {
          const value = applyModifier(v, c.modifier, theme)
          return value === null ? undefined : [decl("color", value)]
        }
      }
    }
    const color = resolveColor(c, theme, ["--text-color", "--color"])
    if (color) return [decl("color", color)]
    const size = theme.resolveWith(c.value.value, ["--text"], ["--line-height", "--letter-spacing", "--font-weight"])
    if (size) {
      const [v, extra] = size
      if (c.modifier) {
        const lh = lineHeight(c.modifier)
        if (!lh) return null
        return [decl("font-size", v), decl("line-height", lh)]
      }
      return [
        decl("font-size", v),
        decl("line-height", extra["--line-height"] ? `var(--tw-leading, ${extra["--line-height"]})` : undefined),
        decl(
          "letter-spacing",
          extra["--letter-spacing"] ? `var(--tw-tracking, ${extra["--letter-spacing"]})` : undefined,
        ),
        decl("font-weight", extra["--font-weight"] ? `var(--tw-font-weight, ${extra["--font-weight"]})` : undefined),
      ]
    }
  })

  const alphaOf = (c: FunctionalCandidate): string | undefined => {
    if (!c.modifier) return
    if (c.modifier.kind === "arbitrary") return c.modifier.value
    if (isPositiveInteger(c.modifier.value)) return `${c.modifier.value}%`
  }

  const shadowUtility = (
    name: string,
    o: {
      props: () => Array<Node>
      colorVar: string
      alphaVar: string
      colorKeys: ReadonlyArray<string>
      shadow: (value: string, alpha: string | undefined, prefix: string) => Array<Node>
      none: () => Array<Node>
      prefix?: string
    },
  ) => {
    const withShadow = (value: string, alpha: string | undefined, prefix = "") => [
      ...o.props(),
      decl(o.alphaVar, alpha),
      ...o.shadow(value, alpha, prefix),
    ]
    const withColor = (color: string) => [...o.props(), decl(o.colorVar, withAlpha(color, `var(${o.alphaVar})`))]
    staticUtility(`${name}-initial`, [o.props, [o.colorVar, "initial"]])
    functional(name, (c) => {
      const alpha = alphaOf(c)
      if (!c.value) {
        const v = theme.get([`--${name}`])
        return v === null ? undefined : withShadow(v, alpha)
      }
      if (c.value.kind === "arbitrary") {
        const v = c.value.value
        if ((c.value.dataType ?? inferDataType(v, ["color"])) !== "color") return withShadow(v, alpha, o.prefix)
        const color = applyModifier(v, c.modifier, theme)
        return color === null ? undefined : withColor(color)
      }
      if (c.value.value === "none") return c.modifier ? undefined : [...o.props(), ...o.none()]
      if (c.value.value === "inherit") return c.modifier ? undefined : [...o.props(), decl(o.colorVar, "inherit")]
      const v = theme.get([`--${name}-${c.value.value}`])
      if (v) return withShadow(v, alpha)
      const color = resolveColor(c, theme, o.colorKeys)
      if (color) return withColor(color)
    })
  }

  shadowUtility("text-shadow", {
    props: () => [property("--tw-text-shadow-color"), property("--tw-text-shadow-alpha", "100%", "<percentage>")],
    colorVar: "--tw-text-shadow-color",
    alphaVar: "--tw-text-shadow-alpha",
    colorKeys: ["--text-shadow-color", "--color"],
    shadow: (v, alpha) => shadowDecls("text-shadow", v, alpha, (color) => `var(--tw-text-shadow-color, ${color})`),
    none: () => [decl("text-shadow", "none")],
  })

  const boxShadowValue =
    "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)"
  const noShadow = "0 0 #0000"
  const shadowProps = () => [
    property("--tw-shadow", noShadow),
    property("--tw-shadow-color"),
    property("--tw-shadow-alpha", "100%", "<percentage>"),
    property("--tw-inset-shadow", noShadow),
    property("--tw-inset-shadow-color"),
    property("--tw-inset-shadow-alpha", "100%", "<percentage>"),
    property("--tw-ring-color"),
    property("--tw-ring-shadow", noShadow),
    property("--tw-inset-ring-color"),
    property("--tw-inset-ring-shadow", noShadow),
    property("--tw-ring-inset"),
    property("--tw-ring-offset-width", "0px", "<length>"),
    property("--tw-ring-offset-color", "#fff"),
    property("--tw-ring-offset-shadow", noShadow),
  ]
  for (const kind of "shadow inset-shadow".split(" ")) {
    const varName = `--tw-${kind}`
    shadowUtility(kind, {
      props: shadowProps,
      colorVar: `${varName}-color`,
      alphaVar: `${varName}-alpha`,
      colorKeys: ["--box-shadow-color", "--color"],
      shadow: (v, alpha, prefix) => [
        ...shadowDecls(varName, v, alpha, (color) => `var(${varName}-color, ${color})`, prefix),
        decl("box-shadow", boxShadowValue),
      ],
      none: () => [decl(varName, noShadow), decl("box-shadow", boxShadowValue)],
      prefix: kind === "inset-shadow" ? "inset " : "",
    })
  }
  staticUtility("ring-inset", [shadowProps, ["--tw-ring-inset", "inset"]])
  const ringColor = theme.get(["--default-ring-color"]) ?? "currentcolor"
  const ringShadow = (v: string) =>
    `var(--tw-ring-inset,) 0 0 0 calc(${v} + var(--tw-ring-offset-width)) var(--tw-ring-color, ${ringColor})`
  const insetRingShadow = (v: string) => `inset 0 0 0 ${v} var(--tw-inset-ring-color, currentcolor)`
  for (
    const [name, shadow, colorVar, defaultWidth] of [
      ["ring", ringShadow, "--tw-ring-color", theme.get(["--default-ring-width"]) ?? "1px"],
      ["inset-ring", insetRingShadow, "--tw-inset-ring-color", "1px"],
    ] as const
  ) {
    const shadowVar = colorVar.replace("-color", "-shadow")
    const width = (v: string) => [...shadowProps(), decl(shadowVar, shadow(v)), decl("box-shadow", boxShadowValue)]
    colorOrWidth(name, {
      colorKeys: ["--ring-color", "--color"],
      widthKeys: ["--ring-width"],
      widthTypes: ["length"],
      defaultWidth,
      color: (v) => [decl(colorVar, v)],
      width,
    })
  }
  const ringOffsetShadow = "var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)"
  colorOrWidth("ring-offset", {
    colorKeys: ["--ring-offset-color", "--color"],
    widthKeys: ["--ring-offset-width"],
    widthTypes: ["length"],
    widthFirst: true,
    color: (v) => [decl("--tw-ring-offset-color", v)],
    width: (v) => [decl("--tw-ring-offset-width", v), decl("--tw-ring-offset-shadow", ringOffsetShadow)],
  })
  for (
    const [side, value] of pairs(
      "t top;tr top right;r right;br bottom right;b bottom;bl bottom left;l left;tl top left",
    )
  ) {
    staticUtility(`bg-gradient-to-${side}`, [
      ["--tw-gradient-position", `to ${value} in oklab`],
      ["background-image", "linear-gradient(var(--tw-gradient-stops))"],
    ])
  }
  for (const [x, y] of pairs("left top;right top;left bottom;right bottom")) {
    staticUtility(`bg-${x}-${y}`, [["background-position", `${x} ${y}`]])
    staticUtility(`object-${x}-${y}`, [["object-position", `${x} ${y}`]])
  }
  functional("max-w-screen", (c) => {
    if (!c.value || c.value.kind === "arbitrary") return
    const v = theme.resolve(c.value.value, ["--breakpoint"])
    if (v) return [decl("max-width", v)]
  })
  for (const [name, prop] of pairs("flex-shrink flex-shrink;flex-grow flex-grow")) {
    functional(name, (c) => {
      if (c.modifier) return
      if (!c.value) return [decl(prop, "1")]
      if (c.value.kind === "arbitrary" || isPositiveInteger(c.value.value)) return [decl(prop, c.value.value)]
    })
  }
  functional("@container", (c) => {
    let type: string | null = null
    if (c.value === null) type = "inline-size"
    else if (c.value.kind === "arbitrary") type = c.value.value
    else if (c.value.value === "normal") type = "normal"
    if (type === null) return
    return c.modifier
      ? [decl("container-type", type), decl("container-name", c.modifier.value)]
      : [decl("container-type", type)]
  })
}

function compareBreakpoints(a: string, b: string, direction: "asc" | "desc"): number {
  if (a === b) return 0
  const ai = a.indexOf("(")
  const bi = b.indexOf("(")
  const aUnit = ai === -1 ? a.replace(/[\d.]+/g, "") : a.slice(0, ai)
  const bUnit = bi === -1 ? b.replace(/[\d.]+/g, "") : b.slice(0, bi)
  const result = (aUnit === bUnit ? 0 : aUnit < bUnit ? -1 : 1) ||
    (direction === "asc" ? parseInt(a) - parseInt(b) : parseInt(b) - parseInt(a))
  return Number.isNaN(result) ? (a < b ? -1 : 1) : result
}

interface VariantDef {
  kind: "static" | "functional" | "compound"
  apply: (node: Rule, variant: Variant) => null | void
  order: number
  compounds: number
  compoundsWith: number
}

const Compounds = { Never: 0, AtRules: 1, StyleRules: 2 } as const

function compoundsFor(selectors: ReadonlyArray<string>): number {
  let flags = 0
  for (const s of selectors) {
    if (s[0] === "@") {
      if (!s.startsWith("@media") && !s.startsWith("@supports") && !s.startsWith("@container")) return 0
      flags |= Compounds.AtRules
      continue
    }
    if (s.includes("::")) return 0
    flags |= Compounds.StyleRules
  }
  return flags
}

class Variants {
  readonly defs = new Map<string, VariantDef>()
  readonly compareFns = new Map<number, (a: Variant, b: Variant) => number>()
  #groupOrder: number | null = null
  #lastOrder = 0

  has(name: string) {
    return this.defs.has(name)
  }

  get(name: string) {
    return this.defs.get(name)
  }

  set(name: string, def: Omit<VariantDef, "order">) {
    const existing = this.defs.get(name)
    if (existing) {
      Object.assign(existing, { kind: def.kind, apply: def.apply, compounds: def.compounds })
      return
    }
    const order = this.#groupOrder ?? (this.#lastOrder = this.#lastOrder + 1)
    this.defs.set(name, { ...def, order })
  }

  static(name: string, apply: VariantDef["apply"], compounds: number = Compounds.StyleRules) {
    this.set(name, { kind: "static", apply, compounds, compoundsWith: 0 })
  }

  /** `name selector | selector` */
  table(text: string) {
    for (const line of text.trim().split("\n")) {
      this.selectors(line.slice(0, line.indexOf(" ")), line.slice(line.indexOf(" ") + 1).split(" | "))
    }
  }

  selectors(name: string, selectors: ReadonlyArray<string>, compounds = compoundsFor(selectors)) {
    this.static(name, (node) => {
      node.nodes = selectors.map((s) => rule(s, node.nodes))
    }, compounds)
  }

  functional(name: string, apply: VariantDef["apply"], compounds: number = Compounds.StyleRules) {
    this.set(name, { kind: "functional", apply, compounds, compoundsWith: 0 })
  }

  compound(name: string, compoundsWith: number, apply: VariantDef["apply"]) {
    this.set(name, { kind: "compound", apply, compounds: Compounds.StyleRules, compoundsWith })
  }

  group(fn: () => void, compare?: (a: Variant, b: Variant) => number) {
    this.#groupOrder = this.#lastOrder + 1
    this.#lastOrder = this.#groupOrder
    if (compare) this.compareFns.set(this.#groupOrder, compare)
    fn()
    this.#groupOrder = null
  }

  compoundsWith(parent: string, child: Variant): boolean {
    const parentDef = this.defs.get(parent)
    const childCompounds = child.kind === "arbitrary"
      ? compoundsFor([child.selector])
      : this.defs.get(child.root)?.compounds
    if (!parentDef || childCompounds === undefined) return false
    return parentDef.kind === "compound" &&
      childCompounds !== 0 &&
      parentDef.compoundsWith !== 0 &&
      (parentDef.compoundsWith & childCompounds) !== 0
  }

  compare(a: Variant | null, b: Variant | null): number {
    if (a === b) return 0
    if (a === null) return -1
    if (b === null) return 1
    if (a.kind === "arbitrary" && b.kind === "arbitrary") return a.selector < b.selector ? -1 : 1
    if (a.kind === "arbitrary") return 1
    if (b.kind === "arbitrary") return -1
    const ao = this.defs.get(a.root)!.order
    const bo = this.defs.get(b.root)!.order
    if (ao !== bo) return ao - bo
    if (a.kind === "compound" && b.kind === "compound") {
      const inner = this.compare(a.variant, b.variant)
      if (inner !== 0) return inner
      if (a.modifier && b.modifier) return a.modifier.value < b.modifier.value ? -1 : 1
      return a.modifier ? 1 : b.modifier ? -1 : 0
    }
    const compareFn = this.compareFns.get(ao)
    if (compareFn) return compareFn(a, b)
    if (a.root !== b.root) return a.root < b.root ? -1 : 1
    const av = "value" in a ? a.value : null
    const bv = "value" in b ? b.value : null
    if (av === null) return -1
    if (bv === null || (av.kind === "arbitrary" && bv.kind !== "arbitrary")) return 1
    if (av.kind !== "arbitrary" && bv.kind === "arbitrary") return -1
    return av.value < bv.value ? -1 : 1
  }

  order(variants: Set<Variant>): Map<Variant, number> {
    const list = [...variants]
    list.sort((a, b) => this.compare(a, b))
    const result = new Map<Variant, number>()
    let prev: Variant | undefined
    let idx = 0
    for (const v of list) {
      if (prev !== undefined && this.compare(prev, v) !== 0) idx++
      result.set(v, idx)
      prev = v
    }
    return result
  }

  apply(node: Rule, variant: Variant, depth = 0): null | void {
    if (variant.kind === "arbitrary") {
      if (variant.relative && depth === 0) return null
      node.nodes = [rule(variant.selector, node.nodes)]
      return
    }
    const def = this.defs.get(variant.root)!
    if (variant.kind === "compound") {
      const slot = rule("@slot", [])
      if (this.apply(slot, variant.variant, depth + 1) === null) return null
      if (variant.root === "not" && slot.nodes.length > 1) return null
      for (const child of slot.nodes) {
        if (child.kind !== "rule" || def.apply(child, variant) === null) return null
      }
      const fill = (nodes: Array<Node>) => {
        for (const child of nodes) {
          if (child.kind !== "rule") continue
          if (child.nodes.length === 0) child.nodes = node.nodes
          else fill(child.nodes)
        }
      }
      fill(slot.nodes)
      node.nodes = slot.nodes
      return
    }
    return def.apply(node, variant)
  }
}

function walkRules(
  node: Rule,
  fn: (rule: Rule, path: Array<Rule>) => "stop" | "skip" | void,
  path: Array<Rule> = [],
): boolean {
  const result = fn(node, path)
  if (result === "stop") return false
  if (result === "skip") return true
  for (const child of node.nodes) {
    if (child.kind === "rule" && !walkRules(child, fn, [...path, node])) return false
  }
  return true
}

function negateConditions(name: string, conditions: Array<string>): Array<string> {
  return conditions.map((condition) => {
    const c = condition.trim()
    const parts = segment(c, " ")
    if (parts[0] === "not") return parts.slice(1).join(" ")
    if (name === "@container") {
      if (parts[0][0] === "(") return `not ${c}`
      if (parts[1] === "not") return `${parts[0]} ${parts.slice(2).join(" ")}`
      return `${parts[0]} not ${parts.slice(1).join(" ")}`
    }
    return `not ${c}`
  })
}

function attributeSelector(value: string): string {
  if (!value.includes("=")) return value
  const [name, ...rest] = segment(value, "=")
  const v = rest.join("=").trim()
  if (v[0] === "'" || v[0] === "\"") return value
  if (v.length > 1) {
    const flag = v[v.length - 1]
    if (v[v.length - 2] === " " && (flag === "i" || flag === "I" || flag === "s" || flag === "S")) {
      return `${name}="${v.slice(0, -2)}" ${flag}`
    }
  }
  return `${name}="${v}"`
}

function createVariants(theme: Theme): Variants {
  const variants = new Variants()
  variants.selectors("*", [":is(& > *)"], Compounds.Never)
  variants.selectors("**", [":is(& *)"], Compounds.Never)

  variants.compound("not", Compounds.StyleRules | Compounds.AtRules, (node, variant) => {
    const v = variant as Extract<Variant, { kind: "compound" }>
    if ((v.variant.kind === "arbitrary" && v.variant.relative) || v.modifier) return null
    let applied = false
    walkRules(node, (r, path) => {
      if (r.nodes.length > 0) return
      const chain = [...path, r]
      const atRules = chain.filter((n) => n.selector[0] === "@")
      const styleRules = chain.filter((n) => n.selector[0] !== "@")
      if (atRules.length > 1 || styleRules.length > 1) return "stop"
      const replacements: Array<Rule> = []
      for (const s of styleRules) {
        if (s.selector.includes("::")) {
          applied = false
          return "stop"
        }
        replacements.push(rule(`&:not(${segment(s.selector, ",").map((p) => p.replaceAll("&", "*")).join(", ")})`, []))
      }
      for (const a of atRules) {
        const match = /^(@media|@supports|@container)\s+(.*)$/s.exec(a.selector)
        if (!match) {
          applied = false
          return "stop"
        }
        const conditions = segment(match[2], ",")
        if (conditions.length > 1) {
          applied = false
          return "stop"
        }
        replacements.push(rule(`${match[1]} ${negateConditions(match[1], conditions).join(", ")}`, []))
      }
      node.selector = "&"
      node.nodes = replacements
      applied = true
      return "skip"
    })
    if (node.selector === "&" && node.nodes.length === 1) Object.assign(node, node.nodes[0])
    if (!applied) return null
  })

  for (const [name, combinator] of [["group", " *"], ["peer", " ~ *"]] as const) {
    variants.compound(name, Compounds.StyleRules, (node, variant) => {
      const v = variant as Extract<Variant, { kind: "compound" }>
      if (v.variant.kind === "arbitrary" && v.variant.relative) return null
      const marker = v.modifier ? `:where(.${name}\\/${v.modifier.value})` : `:where(.${name})`
      let applied = false
      walkRules(node, (r, path) => {
        if (r.selector[0] === "@") return
        if (path.some((p) => p.selector[0] !== "@")) {
          applied = false
          return "stop"
        }
        let selector = r.selector.replaceAll("&", marker)
        if (segment(selector, ",").length > 1) selector = `:is(${selector})`
        r.selector = `&:is(${selector}${combinator})`
        applied = true
      })
      if (!applied) return null
    })
  }

  variants.table(`
first-letter &::first-letter
first-line &::first-line
marker & *::marker | &::marker | & *::-webkit-details-marker | &::-webkit-details-marker
selection & *::selection | &::selection
file &::file-selector-button
placeholder &::placeholder
backdrop &::backdrop
details-content &::details-content
`)
  for (const pseudo of "before after".split(" ")) {
    variants.static(pseudo, (node) => {
      const content: Property = { ...property("--tw-content", "\"\""), initialFirst: true }
      node.nodes = [rule(`&::${pseudo}`, [content, decl("content", "var(--tw-content)"), ...node.nodes])]
    }, Compounds.Never)
  }
  variants.table(`
first &:first-child
last &:last-child
only &:only-child
odd &:nth-child(odd)
even &:nth-child(even)
first-of-type &:first-of-type
last-of-type &:last-of-type
only-of-type &:only-of-type
visited &:visited
target &:target
open &:is([open], :popover-open, :open)
default &:default
checked &:checked
indeterminate &:indeterminate
placeholder-shown &:placeholder-shown
autofill &:autofill
optional &:optional
required &:required
valid &:valid
invalid &:invalid
user-valid &:user-valid
user-invalid &:user-invalid
in-range &:in-range
out-of-range &:out-of-range
read-only &:read-only
empty &:empty
focus-within &:focus-within
`)
  variants.static("hover", (node) => {
    node.nodes = [rule("&:hover", [rule("@media (hover: hover)", node.nodes)])]
  })
  variants.table(`
focus &:focus
focus-visible &:focus-visible
active &:active
enabled &:enabled
disabled &:disabled
inert &:is([inert], [inert] *)
`)

  for (const name of ["in", "has"] as const) {
    variants.compound(name, Compounds.StyleRules, (node, variant) => {
      if ((variant as { modifier?: unknown }).modifier) return null
      let applied = false
      walkRules(node, (r, path) => {
        if (r.selector[0] === "@") return
        if (path.some((p) => p.selector[0] !== "@")) {
          applied = false
          return "stop"
        }
        const inner = r.selector.replaceAll("&", "*")
        r.selector = name === "in" ? `:where(${inner}) &` : `&:has(${inner})`
        applied = true
      })
      if (!applied) return null
    })
  }

  const functionalValue = (variant: Variant) => variant as Extract<Variant, { kind: "functional" }>
  variants.functional("aria", (node, variant) => {
    const v = functionalValue(variant)
    if (!v.value || v.modifier) return null
    node.nodes = [
      rule(
        v.value.kind === "arbitrary"
          ? `&[aria-${attributeSelector(v.value.value)}]`
          : `&[aria-${v.value.value}="true"]`,
        node.nodes,
      ),
    ]
  })
  variants.functional("data", (node, variant) => {
    const v = functionalValue(variant)
    if (!v.value || v.modifier) return null
    node.nodes = [rule(`&[data-${attributeSelector(v.value.value)}]`, node.nodes)]
  })
  for (
    const [name, pseudo] of pairs(
      "nth nth-child;nth-last nth-last-child;nth-of-type nth-of-type;nth-last-of-type nth-last-of-type",
    )
  ) {
    variants.functional(name, (node, variant) => {
      const v = functionalValue(variant)
      if (!v.value || v.modifier || (v.value.kind === "named" && !isPositiveInteger(v.value.value))) return null
      node.nodes = [rule(`&:${pseudo}(${v.value.value})`, node.nodes)]
    })
  }
  variants.functional("supports", (node, variant) => {
    const v = functionalValue(variant)
    if (!v.value || v.modifier) return null
    let value = v.value.value
    if (/^[\w-]*\s*\(/.test(value)) {
      node.nodes = [rule(`@supports ${value.replace(/\b(and|or|not)\b/g, " $1 ")}`, node.nodes)]
      return
    }
    if (!value.includes(":")) value = `${value}: var(--tw)`
    if (value[0] !== "(" || value[value.length - 1] !== ")") value = `(${value})`
    node.nodes = [rule(`@supports ${value}`, node.nodes)]
  }, Compounds.AtRules)
  variants.table(`
motion-safe @media (prefers-reduced-motion: no-preference)
motion-reduce @media (prefers-reduced-motion: reduce)
contrast-more @media (prefers-contrast: more)
contrast-less @media (prefers-contrast: less)
`)

  const compareResolved = (
    a: Variant,
    b: Variant,
    direction: "asc" | "desc",
    resolve: (v: Variant) => string | null,
  ) => {
    if (a === b) return 0
    const av = resolve(a)
    if (av === null) return direction === "asc" ? -1 : 1
    const bv = resolve(b)
    if (bv === null) return direction === "asc" ? 1 : -1
    return compareBreakpoints(av, bv, direction)
  }
  const breakpointCache = new WeakMap<Variant, string | null>()
  const breakpoint = (v: Variant): string | null => {
    if (breakpointCache.has(v)) return breakpointCache.get(v)!
    let result: string | null = null
    if (v.kind === "static") result = theme.resolveValue(v.root, ["--breakpoint"])
    else if (v.kind === "functional" && v.value && !v.modifier) {
      const value = v.value.kind === "arbitrary" ? v.value.value : theme.resolveValue(v.value.value, ["--breakpoint"])
      result = !value || value.includes("var(") ? null : value
    }
    breakpointCache.set(v, result)
    return result
  }
  variants.group(() => {
    variants.functional("max", (node, variant) => {
      if ((variant as { modifier?: unknown }).modifier) return null
      const value = breakpoint(variant)
      if (value === null) return null
      node.nodes = [rule(`@media (width < ${value})`, node.nodes)]
    }, Compounds.AtRules)
  }, (a, b) => compareResolved(a, b, "desc", breakpoint))
  variants.group(() => {
    for (const [name, value] of theme.namespace("--breakpoint")) {
      if (name === null) continue
      variants.static(name, (node) => {
        node.nodes = [rule(`@media (width >= ${value})`, node.nodes)]
      }, Compounds.AtRules)
    }
    variants.functional("min", (node, variant) => {
      if ((variant as { modifier?: unknown }).modifier) return null
      const value = breakpoint(variant)
      if (value === null) return null
      node.nodes = [rule(`@media (width >= ${value})`, node.nodes)]
    }, Compounds.AtRules)
  }, (a, b) => compareResolved(a, b, "asc", breakpoint))

  const container = (v: Variant): string | null => {
    if (v.kind !== "functional" || v.value === null) return null
    const value = v.value.kind === "arbitrary" ? v.value.value : theme.resolveValue(v.value.value, ["--container"])
    return !value || value.includes("var(") ? null : value
  }
  const containerQuery = (op: string) => (node: Rule, variant: Variant) => {
    const value = container(variant)
    if (value === null) return null
    const v = functionalValue(variant)
    node.nodes = [rule(`@container ${v.modifier ? `${v.modifier.value} ` : ""}(width ${op} ${value})`, node.nodes)]
  }
  variants.group(() => {
    variants.functional("@max", containerQuery("<"), Compounds.AtRules)
  }, (a, b) => compareResolved(a, b, "desc", container))
  variants.group(() => {
    variants.functional("@", containerQuery(">="), Compounds.AtRules)
    variants.functional("@min", containerQuery(">="), Compounds.AtRules)
  }, (a, b) => compareResolved(a, b, "asc", container))

  variants.table(`
portrait @media (orientation: portrait)
landscape @media (orientation: landscape)
ltr &:where(:dir(ltr), [dir="ltr"], [dir="ltr"] *)
rtl &:where(:dir(rtl), [dir="rtl"], [dir="rtl"] *)
dark @media (prefers-color-scheme: dark)
starting @starting-style
print @media print
forced-colors @media (forced-colors: active)
inverted-colors @media (inverted-colors: inverted)
pointer-none @media (pointer: none)
pointer-coarse @media (pointer: coarse)
pointer-fine @media (pointer: fine)
any-pointer-none @media (any-pointer: none)
any-pointer-coarse @media (any-pointer: coarse)
any-pointer-fine @media (any-pointer: fine)
noscript @media (scripting: none)
`)
  return variants
}

/** `name property:value;property:value` */
const STATIC_UTILITIES = `
sr-only position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border-width:0
not-sr-only position:static;width:auto;height:auto;padding:0;margin:0;overflow:visible;clip-path:none;white-space:normal
pointer-events-none pointer-events:none
pointer-events-auto pointer-events:auto
visible visibility:visible
invisible visibility:hidden
collapse visibility:collapse
isolate isolation:isolate
isolation-auto isolation:auto
box-border box-sizing:border-box
box-content box-sizing:content-box
field-sizing-content field-sizing:content
field-sizing-fixed field-sizing:fixed
size-auto --tw-sort:size;width:auto;height:auto
w-auto width:auto
h-auto height:auto
min-w-auto min-width:auto
min-h-auto min-height:auto
h-lh height:1lh
min-h-lh min-height:1lh
max-h-lh max-height:1lh
w-screen width:100vw
min-w-screen min-width:100vw
max-w-screen max-width:100vw
h-screen height:100vh
min-h-screen min-height:100vh
max-h-screen max-height:100vh
max-w-none max-width:none
max-h-none max-height:none
flex-auto flex:auto
flex-initial flex:0 auto
flex-none flex:none
basis-auto flex-basis:auto
basis-full flex-basis:100%
table-auto table-layout:auto
table-fixed table-layout:fixed
caption-top caption-side:top
caption-bottom caption-side:bottom
border-collapse border-collapse:collapse
border-separate border-collapse:separate
translate-none translate:none
scale-none scale:none
rotate-none rotate:none
transform-none transform:none
transform-flat transform-style:flat
transform-3d transform-style:preserve-3d
backface-visible backface-visibility:visible
backface-hidden backface-visibility:hidden
resize-none resize:none
resize-x resize:horizontal
resize-y resize:vertical
resize resize:both
snap-none scroll-snap-type:none
snap-align-none scroll-snap-align:none
snap-start scroll-snap-align:start
snap-end scroll-snap-align:end
snap-center scroll-snap-align:center
snap-normal scroll-snap-stop:normal
snap-always scroll-snap-stop:always
list-inside list-style-position:inside
list-outside list-style-position:outside
appearance-none appearance:none
appearance-auto appearance:auto
grid-flow-row grid-auto-flow:row
grid-flow-col grid-auto-flow:column
grid-flow-dense grid-auto-flow:dense
grid-flow-row-dense grid-auto-flow:row dense
grid-flow-col-dense grid-auto-flow:column dense
flex-wrap flex-wrap:wrap
flex-nowrap flex-wrap:nowrap
flex-wrap-reverse flex-wrap:wrap-reverse
accent-auto accent-color:auto
scroll-auto scroll-behavior:auto
scroll-smooth scroll-behavior:smooth
truncate overflow:hidden;text-overflow:ellipsis;white-space:nowrap
text-ellipsis text-overflow:ellipsis
text-clip text-overflow:clip
text-wrap text-wrap:wrap
text-nowrap text-wrap:nowrap
text-balance text-wrap:balance
text-pretty text-wrap:pretty
break-normal overflow-wrap:normal;word-break:normal
break-all word-break:break-all
break-keep word-break:keep-all
wrap-anywhere overflow-wrap:anywhere
wrap-break-word overflow-wrap:break-word
wrap-normal overflow-wrap:normal
bg-auto background-size:auto
bg-cover background-size:cover
bg-contain background-size:contain
bg-fixed background-attachment:fixed
bg-local background-attachment:local
bg-scroll background-attachment:scroll
bg-none background-image:none
via-none --tw-gradient-via-stops:initial
mask-none mask-image:none
mask-alpha mask-mode:alpha
mask-luminance mask-mode:luminance
mask-match mask-mode:match-source
mask-type-alpha mask-type:alpha
mask-type-luminance mask-type:luminance
mask-no-clip mask-clip:no-clip
mask-circle --tw-mask-radial-shape:circle
mask-ellipse --tw-mask-radial-shape:ellipse
box-decoration-slice -webkit-box-decoration-break:slice;box-decoration-break:slice
box-decoration-clone -webkit-box-decoration-break:clone;box-decoration-break:clone
bg-clip-text background-clip:text
mix-blend-plus-darker mix-blend-mode:plus-darker
mix-blend-plus-lighter mix-blend-mode:plus-lighter
fill-none fill:none
stroke-none stroke:none
uppercase text-transform:uppercase
lowercase text-transform:lowercase
capitalize text-transform:capitalize
normal-case text-transform:none
italic font-style:italic
not-italic font-style:normal
underline text-decoration-line:underline
overline text-decoration-line:overline
line-through text-decoration-line:line-through
no-underline text-decoration-line:none
decoration-auto text-decoration-thickness:auto
decoration-from-font text-decoration-thickness:from-font
transition-discrete transition-behavior:allow-discrete
transition-normal transition-behavior:normal
will-change-auto will-change:auto
will-change-scroll will-change:scroll-position
will-change-contents will-change:contents
will-change-transform will-change:transform
content-none --tw-content:none;content:none
contain-none contain:none
contain-content contain:content
contain-strict contain:strict
forced-color-adjust-none forced-color-adjust:none
forced-color-adjust-auto forced-color-adjust:auto
antialiased -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale
subpixel-antialiased -webkit-font-smoothing:auto;-moz-osx-font-smoothing:auto
normal-nums font-variant-numeric:normal
overflow-ellipsis text-overflow:ellipsis
decoration-slice -webkit-box-decoration-break:slice;box-decoration-break:slice
decoration-clone -webkit-box-decoration-break:clone;box-decoration-break:clone
order-none order:0
break-words overflow-wrap:break-word
place-content-center place-content:center
place-content-start place-content:start
place-content-end place-content:end
place-content-center-safe place-content:safe center
place-content-end-safe place-content:safe end
place-content-between place-content:space-between
place-content-around place-content:space-around
place-content-evenly place-content:space-evenly
place-content-baseline place-content:baseline
place-content-stretch place-content:stretch
place-items-center place-items:center
place-items-start place-items:start
place-items-end place-items:end
place-items-center-safe place-items:safe center
place-items-end-safe place-items:safe end
place-items-baseline place-items:baseline
place-items-stretch place-items:stretch
content-normal align-content:normal
content-center align-content:center
content-start align-content:flex-start
content-end align-content:flex-end
content-center-safe align-content:safe center
content-end-safe align-content:safe flex-end
content-between align-content:space-between
content-around align-content:space-around
content-evenly align-content:space-evenly
content-baseline align-content:baseline
content-stretch align-content:stretch
items-center align-items:center
items-start align-items:flex-start
items-end align-items:flex-end
items-center-safe align-items:safe center
items-end-safe align-items:safe flex-end
items-baseline align-items:baseline
items-baseline-last align-items:last baseline
items-stretch align-items:stretch
justify-normal justify-content:normal
justify-center justify-content:center
justify-start justify-content:flex-start
justify-end justify-content:flex-end
justify-center-safe justify-content:safe center
justify-end-safe justify-content:safe flex-end
justify-between justify-content:space-between
justify-around justify-content:space-around
justify-evenly justify-content:space-evenly
justify-baseline justify-content:baseline
justify-stretch justify-content:stretch
justify-items-normal justify-items:normal
justify-items-center justify-items:center
justify-items-start justify-items:start
justify-items-end justify-items:end
justify-items-center-safe justify-items:safe center
justify-items-end-safe justify-items:safe end
justify-items-stretch justify-items:stretch
place-self-auto place-self:auto
place-self-start place-self:start
place-self-end place-self:end
place-self-center place-self:center
place-self-end-safe place-self:safe end
place-self-center-safe place-self:safe center
place-self-stretch place-self:stretch
self-auto align-self:auto
self-start align-self:flex-start
self-end align-self:flex-end
self-center align-self:center
self-end-safe align-self:safe flex-end
self-center-safe align-self:safe center
self-stretch align-self:stretch
self-baseline align-self:baseline
self-baseline-last align-self:last baseline
justify-self-auto justify-self:auto
justify-self-start justify-self:flex-start
justify-self-end justify-self:flex-end
justify-self-center justify-self:center
justify-self-end-safe justify-self:safe flex-end
justify-self-center-safe justify-self:safe center
justify-self-stretch justify-self:stretch
`

/** Utilities sort by the first of these properties they declare. */
const PROPERTY_ORDER = new Map(
  `
  container-type pointer-events visibility position inset inset-inline inset-block inset-inline-start inset-inline-end
  top right bottom left isolation z-index order grid-column grid-column-start grid-column-end grid-row grid-row-start
  grid-row-end float clear --tw-container-component margin margin-inline margin-block margin-inline-start
  margin-inline-end margin-top margin-right margin-bottom margin-left box-sizing display field-sizing aspect-ratio
  height max-height min-height width max-width min-width flex flex-shrink flex-grow flex-basis table-layout
  caption-side border-collapse border-spacing transform-origin translate --tw-translate-x --tw-translate-y
  --tw-translate-z scale --tw-scale-x --tw-scale-y --tw-scale-z rotate --tw-rotate-x --tw-rotate-y --tw-rotate-z
  --tw-skew-x --tw-skew-y transform animation cursor touch-action --tw-pan-x --tw-pan-y --tw-pinch-zoom resize
  scroll-snap-type --tw-scroll-snap-strictness scroll-snap-align scroll-snap-stop scroll-margin scroll-margin-inline
  scroll-margin-block scroll-margin-inline-start scroll-margin-inline-end scroll-margin-top scroll-margin-right
  scroll-margin-bottom scroll-margin-left scroll-padding scroll-padding-inline scroll-padding-block
  scroll-padding-inline-start scroll-padding-inline-end scroll-padding-top scroll-padding-right scroll-padding-bottom
  scroll-padding-left list-style-position list-style-type list-style-image appearance columns break-before
  break-inside break-after grid-auto-columns grid-auto-flow grid-auto-rows grid-template-columns grid-template-rows
  flex-direction flex-wrap place-content place-items align-content align-items justify-content justify-items gap
  column-gap row-gap --tw-space-x-reverse --tw-space-y-reverse divide-x-width divide-y-width --tw-divide-y-reverse
  divide-style divide-color place-self align-self justify-self overflow overflow-x overflow-y overscroll-behavior
  overscroll-behavior-x overscroll-behavior-y scroll-behavior border-radius border-start-radius border-end-radius
  border-top-radius border-right-radius border-bottom-radius border-left-radius border-start-start-radius
  border-start-end-radius border-end-end-radius border-end-start-radius border-top-left-radius border-top-right-radius
  border-bottom-right-radius border-bottom-left-radius border-width border-inline-width border-block-width
  border-inline-start-width border-inline-end-width border-top-width border-right-width border-bottom-width
  border-left-width border-style border-inline-style border-block-style border-inline-start-style
  border-inline-end-style border-top-style border-right-style border-bottom-style border-left-style border-color
  border-inline-color border-block-color border-inline-start-color border-inline-end-color border-top-color
  border-right-color border-bottom-color border-left-color background-color background-image --tw-gradient-position
  --tw-gradient-stops --tw-gradient-via-stops --tw-gradient-from --tw-gradient-from-position --tw-gradient-via
  --tw-gradient-via-position --tw-gradient-to --tw-gradient-to-position mask-image --tw-mask-top
  --tw-mask-top-from-color --tw-mask-top-from-position --tw-mask-top-to-color --tw-mask-top-to-position
  --tw-mask-right --tw-mask-right-from-color --tw-mask-right-from-position --tw-mask-right-to-color
  --tw-mask-right-to-position --tw-mask-bottom --tw-mask-bottom-from-color --tw-mask-bottom-from-position
  --tw-mask-bottom-to-color --tw-mask-bottom-to-position --tw-mask-left --tw-mask-left-from-color
  --tw-mask-left-from-position --tw-mask-left-to-color --tw-mask-left-to-position --tw-mask-linear
  --tw-mask-linear-position --tw-mask-linear-from-color --tw-mask-linear-from-position --tw-mask-linear-to-color
  --tw-mask-linear-to-position --tw-mask-radial --tw-mask-radial-shape --tw-mask-radial-size --tw-mask-radial-position
  --tw-mask-radial-from-color --tw-mask-radial-from-position --tw-mask-radial-to-color --tw-mask-radial-to-position
  --tw-mask-conic --tw-mask-conic-position --tw-mask-conic-from-color --tw-mask-conic-from-position
  --tw-mask-conic-to-color --tw-mask-conic-to-position box-decoration-break background-size background-attachment
  background-clip background-position background-repeat background-origin mask-composite mask-mode mask-type mask-size
  mask-clip mask-position mask-repeat mask-origin fill stroke stroke-width object-fit object-position padding
  padding-inline padding-block padding-inline-start padding-inline-end padding-top padding-right padding-bottom
  padding-left text-align text-indent vertical-align font-family font-size line-height font-weight letter-spacing
  text-wrap overflow-wrap word-break text-overflow hyphens white-space color text-transform font-style font-stretch
  font-variant-numeric text-decoration-line text-decoration-color text-decoration-style text-decoration-thickness
  text-underline-offset -webkit-font-smoothing placeholder-color caret-color accent-color color-scheme opacity
  background-blend-mode mix-blend-mode box-shadow --tw-shadow --tw-shadow-color --tw-ring-shadow --tw-ring-color
  --tw-inset-shadow --tw-inset-shadow-color --tw-inset-ring-shadow --tw-inset-ring-color --tw-ring-offset-width
  --tw-ring-offset-color outline outline-width outline-offset outline-color --tw-blur --tw-brightness --tw-contrast
  --tw-drop-shadow --tw-grayscale --tw-hue-rotate --tw-invert --tw-saturate --tw-sepia filter --tw-backdrop-blur
  --tw-backdrop-brightness --tw-backdrop-contrast --tw-backdrop-grayscale --tw-backdrop-hue-rotate
  --tw-backdrop-invert --tw-backdrop-opacity --tw-backdrop-saturate --tw-backdrop-sepia backdrop-filter
  transition-property transition-behavior transition-delay transition-duration transition-timing-function will-change
  contain content forced-color-adjust
`
    .trim()
    .split(/\s+/)
    .map((property, i) => [property, i]),
)
