export type HTMLOrSVG = HTMLElement | SVGElement | MathMLElement

type SignalFilterOptions = {
  include?: RegExp | string
  exclude?: RegExp | string
}

type FetchActionArgs = RequestInit & {
  selector?: string
  headers?: Record<string, string>
  contentType?: "json" | "form"
  filterSignals?: SignalFilterOptions
  openWhenHidden?: boolean
  payload?: any
  requestCancellation?: "auto" | "cleanup" | "disabled" | AbortController
  retry?: "auto" | "error" | "always" | "never"
  retryInterval?: number
}

export interface DataActions {
  peek: <T>(fn: () => T) => T
  setAll: (value: any, filter?: SignalFilterOptions) => void
  toggleAll: (filter?: SignalFilterOptions) => void
  get: (url: string, args?: FetchActionArgs) => Promise<void>
  post: (url: string, args?: FetchActionArgs) => Promise<void>
  put: (url: string, args?: FetchActionArgs) => Promise<void>
  patch: (url: string, args?: FetchActionArgs) => Promise<void>
  delete: (url: string, args?: FetchActionArgs) => Promise<void>
}

export type DataEvent<E extends HTMLOrSVG = HTMLOrSVG> =
  & Omit<Event, "currentTarget" | "target">
  & DataActions
  & {
    signals: Record<string, any>
    actions: DataActions
    target: HTMLOrSVG
    currentTarget: E
    window: Window & typeof globalThis
  }

type DataFunction<T = any, E extends HTMLOrSVG = HTMLOrSVG> = (e: DataEvent<E>) => T
type DataLifecycleFunction<E extends HTMLOrSVG = HTMLOrSVG> = DataFunction<void | (() => void), E>

// Datastar object types for specific attributes
type DatastarSignalsObject = Record<string, any>
type DatastarClassObject<E extends HTMLOrSVG = HTMLOrSVG> = Record<string, boolean | string | DataFunction<any, E>>
type DatastarAttrObject<E extends HTMLOrSVG = HTMLOrSVG> = Record<
  string,
  string | boolean | number | DataFunction<any, E>
>
type DatastarStyleObject<E extends HTMLOrSVG = HTMLOrSVG> = Record<
  string,
  string | number | boolean | null | undefined | DataFunction<any, E>
>

/**
 * Datastar attributes for reactive web applications
 * @see https://data-star.dev/reference/attributes
 */
export interface DatastarAttributes<E extends HTMLOrSVG = HTMLOrSVG> {
  // Core attributes that can accept objects (but also strings)
  "data-signals"?: string | DatastarSignalsObject | undefined
  "data-class"?: string | DataFunction<DatastarClassObject<E>, E> | DatastarClassObject<E> | undefined
  "data-attr"?: string | DataFunction<DatastarAttrObject<E>, E> | DatastarAttrObject<E> | undefined
  "data-style"?: string | DataFunction<DatastarStyleObject<E>, E> | DatastarStyleObject<E> | undefined

  // Boolean/presence attributes (but also strings)
  "data-show"?: string | DataFunction<boolean, E> | boolean | undefined
  "data-ignore"?: string | boolean | undefined
  "data-ignore-morph"?: string | boolean | undefined

  // Attributes that accept function expressions
  "data-bind"?: string | undefined
  "data-computed"?:
    | string
    | DataFunction<any, E>
    | Record<string, DataFunction<any, E> | Record<string, DataFunction<any, E>>>
    | undefined
  "data-effect"?: string | DataLifecycleFunction<E> | undefined
  "data-init"?: string | DataLifecycleFunction<E> | undefined
  "data-indicator"?: string | undefined
  "data-json-signals"?: true | string | undefined
  "data-on"?: string | DataFunction<any, E> | undefined
  "data-on-intersect"?: string | DataFunction<any, E> | undefined
  "data-on-interval"?: string | DataFunction<any, E> | undefined
  "data-on-load"?: string | DataFunction<any, E> | undefined
  "data-on-signal-patch"?: string | DataFunction<any, E> | undefined
  "data-on-signal-patch-filter"?: string | undefined
  "data-preserve-attr"?: string | undefined
  "data-ref"?: string | undefined
  "data-text"?: string | DataFunction<string | number | boolean, E> | undefined

  // Pro attributes
  "data-animate"?: string | undefined
  "data-custom-validity"?: string | DataFunction<any, E> | undefined
  "data-on-raf"?: string | DataFunction<any, E> | undefined
  "data-on-resize"?: string | DataFunction<any, E> | undefined
  "data-persist"?: string | undefined
  "data-query-string"?: string | undefined
  "data-replace-url"?: string | undefined
  "data-scroll-into-view"?: string | undefined
  "data-view-transition"?: string | undefined

  // Dynamic attributes with suffixes
  [key: `data-class:${string}`]: string | DataFunction<boolean, E> | undefined
  [key: `data-attr:${string}`]: string | DataFunction<string | number | boolean | null | undefined, E> | undefined
  [key: `data-style:${string}`]: string | DataFunction<string | number | null | undefined, E> | undefined
  [key: `data-computed:${string}`]: string | DataFunction<any, E> | undefined
  [key: `data-on:${string}`]: string | DataFunction<any, E> | undefined
}
