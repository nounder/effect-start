import type { DataEvent } from "./types.d.ts"

type DataFunction<T = any> = (e: DataEvent) => T
type DataLifecycleFunction = DataFunction<void | (() => void)>

// Datastar object types for specific attributes
type DatastarSignalsObject = Record<string, any>
type DatastarClassObject = Record<string, boolean | string | DataFunction>
type DatastarAttrObject = Record<
  string,
  string | boolean | number | DataFunction
>
type DatastarStyleObject = Record<
  string,
  string | number | boolean | null | undefined | DataFunction
>

/**
 * Datastar attributes for reactive web applications
 * @see https://data-star.dev/reference/attributes
 */
export interface DatastarAttributes {
  // Core attributes that can accept objects (but also strings)
  "data-signals"?: string | DatastarSignalsObject | undefined
  "data-class"?: string | DataFunction<DatastarClassObject> | DatastarClassObject | undefined
  "data-attr"?: string | DataFunction<DatastarAttrObject> | DatastarAttrObject | undefined
  "data-style"?: string | DataFunction<DatastarStyleObject> | DatastarStyleObject | undefined

  // Boolean/presence attributes (but also strings)
  "data-show"?: string | DataFunction<boolean> | boolean | undefined
  "data-ignore"?: string | boolean | undefined
  "data-ignore-morph"?: string | boolean | undefined

  // Attributes that accept function expressions
  "data-bind"?: string | undefined
  "data-computed"?:
    | string
    | DataFunction
    | Record<string, DataFunction | Record<string, DataFunction>>
    | undefined
  "data-effect"?: string | DataLifecycleFunction | undefined
  "data-init"?: string | DataLifecycleFunction | undefined
  "data-indicator"?: string | undefined
  "data-json-signals"?: true | string | undefined
  "data-on"?: string | DataFunction | undefined
  "data-on-intersect"?: string | DataFunction | undefined
  "data-on-interval"?: string | DataFunction | undefined
  "data-on-load"?: string | DataFunction | undefined
  "data-on-signal-patch"?: string | DataFunction | undefined
  "data-on-signal-patch-filter"?: string | undefined
  "data-preserve-attr"?: string | undefined
  "data-ref"?: string | undefined
  "data-text"?: string | DataFunction<string | number | boolean> | undefined

  // Pro attributes
  "data-animate"?: string | undefined
  "data-custom-validity"?: string | DataFunction | undefined
  "data-on-raf"?: string | DataFunction | undefined
  "data-on-resize"?: string | DataFunction | undefined
  "data-persist"?: string | undefined
  "data-query-string"?: string | undefined
  "data-replace-url"?: string | undefined
  "data-scroll-into-view"?: string | undefined
  "data-view-transition"?: string | undefined

  // Dynamic attributes with suffixes
  [key: `data-class:${string}`]: string | DataFunction<boolean> | undefined
  [key: `data-attr:${string}`]: string | DataFunction<string | number | boolean | null | undefined> | undefined
  [key: `data-style:${string}`]: string | DataFunction<string | number | null | undefined> | undefined
  [key: `data-computed:${string}`]: string | DataFunction | undefined
  [key: `data-on:${string}`]: string | DataFunction | undefined
}
