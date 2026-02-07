import type { DataEvent } from "./engine.ts"

// Datastar object types for specific attributes
type DatastarSignalsObject = Record<string, any>
type DatastarClassObject = Record<string, boolean | string>
type DatastarAttrObject = Record<string, string | boolean | number>
type DatastarStyleObject = Record<string, string | number | boolean | null | undefined>

type DatastarFn = (e: DataEvent) => any

// TODO: support leading/trailing options
// e.g. { debounce: { ms: 500, leading: true, noTrailing: true } }
type DatastarOnConfig = {
  prevent?: boolean
  stop?: boolean
  capture?: boolean
  passive?: boolean
  once?: boolean
  outside?: boolean
  window?: boolean
  viewTransition?: boolean
} & (
  | { debounce?: number; throttle?: never }
  | { debounce?: never; throttle?: number }
)

type DatastarOnFn = DatastarFn | [handler: DatastarFn, config: DatastarOnConfig]

/**
 * Datastar attributes for reactive web applications
 * @see https://data-star.dev/reference/attributes
 */
export interface DatastarAttributes {
  // Core attributes that can accept objects (but also strings)
  "data-signals"?: string | DatastarSignalsObject | undefined
  "data-class"?: string | DatastarFn | DatastarClassObject | undefined
  "data-attr"?: string | DatastarFn | DatastarAttrObject | undefined
  "data-style"?: string | DatastarFn | DatastarStyleObject | undefined

  // Boolean/presence attributes (but also strings)
  "data-show"?: string | DatastarFn | boolean | undefined
  "data-ignore"?: string | boolean | undefined
  "data-ignore-morph"?: string | boolean | undefined

  // Attributes that accept function expressions
  "data-bind"?: string | undefined
  "data-computed"?: string | DatastarFn | undefined
  "data-effect"?: string | DatastarFn | undefined
  "data-indicator"?: string | undefined
  "data-json-signals"?: string | undefined
  "data-on"?: string | DatastarOnFn | undefined
  "data-on-intersect"?: string | DatastarOnFn | undefined
  "data-on-interval"?: string | DatastarOnFn | undefined
  "data-on-load"?: string | DatastarOnFn | undefined
  "data-on-signal-patch"?: string | DatastarOnFn | undefined
  "data-on-signal-patch-filter"?: string | undefined
  "data-preserve-attr"?: string | undefined
  "data-ref"?: string | undefined
  "data-text"?: string | DatastarFn | undefined

  // Pro attributes
  "data-animate"?: string | undefined
  "data-custom-validity"?: string | DatastarFn | undefined
  "data-on-raf"?: string | DatastarOnFn | undefined
  "data-on-resize"?: string | DatastarOnFn | undefined
  "data-persist"?: string | undefined
  "data-query-string"?: string | undefined
  "data-replace-url"?: string | undefined
  "data-scroll-into-view"?: string | undefined
  "data-view-transition"?: string | undefined

  // Dynamic attributes with suffixes
  [key: `data-signals-${string}`]: string | undefined
  [key: `data-class-${string}`]: string | DatastarFn | undefined
  [key: `data-attr-${string}`]: string | DatastarFn | undefined
  [key: `data-style-${string}`]: string | DatastarFn | undefined
  [key: `data-bind-${string}`]: string | undefined
  [key: `data-computed-${string}`]: string | DatastarFn | undefined
  [key: `data-indicator-${string}`]: string | undefined
  [key: `data-ref-${string}`]: string | undefined
  [key: `data-on-${string}`]: string | DatastarOnFn | undefined
}
