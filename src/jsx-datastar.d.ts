// Datastar object types for specific attributes
type DatastarSignalsObject = Record<string, any>
type DatastarClassObject = Record<string, boolean | string>
type DatastarAttrObject = Record<string, string | boolean | number>
type DatastarStyleObject = Record<
  string,
  string | number | boolean | null | undefined
>

/**
 * Datastar attributes for reactive web applications
 * @see https://data-star.dev/reference/attributes
 */
export interface DatastarAttributes {
  // Core attributes that can accept objects (but also strings)
  "data-signals"?: string | DatastarSignalsObject | undefined
  "data-class"?: string | DatastarClassObject | undefined
  "data-attr"?: string | DatastarAttrObject | undefined
  "data-style"?: string | DatastarStyleObject | undefined

  // Boolean/presence attributes (but also strings)
  "data-show"?: string | boolean | undefined
  "data-ignore"?: string | boolean | undefined
  "data-ignore-morph"?: string | boolean | undefined

  // All other Datastar attributes as strings only
  "data-bind"?: string | undefined
  "data-computed"?: string | undefined
  "data-effect"?: string | undefined
  "data-indicator"?: string | undefined
  "data-json-signals"?: string | undefined
  "data-on"?: string | undefined
  "data-on-intersect"?: string | undefined
  "data-on-interval"?: string | undefined
  "data-on-load"?: string | undefined
  "data-on-signal-patch"?: string | undefined
  "data-on-signal-patch-filter"?: string | undefined
  "data-preserve-attr"?: string | undefined
  "data-ref"?: string | undefined
  "data-text"?: string | undefined

  // Pro attributes (strings only)
  "data-animate"?: string | undefined
  "data-custom-validity"?: string | undefined
  "data-on-raf"?: string | undefined
  "data-on-resize"?: string | undefined
  "data-persist"?: string | undefined
  "data-query-string"?: string | undefined
  "data-replace-url"?: string | undefined
  "data-scroll-into-view"?: string | undefined
  "data-view-transition"?: string | undefined

  // Dynamic attributes with suffixes
  [key: `data-signals-${string}`]:
    | string
    | number
    | boolean
    | object
    | undefined
  [key: `data-class-${string}`]: string | boolean | undefined
  [key: `data-attr-${string}`]: string | boolean | number | undefined
  [key: `data-style-${string}`]: string | number | boolean | null | undefined
  [key: `data-bind-${string}`]: string | undefined
  [key: `data-computed-${string}`]: string | undefined
  [key: `data-indicator-${string}`]: string | undefined
  [key: `data-ref-${string}`]: string | undefined
  [key: `data-on-${string}`]: string | undefined
}
