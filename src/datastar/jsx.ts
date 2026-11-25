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
  payload?: unknown
  requestCancellation?: "auto" | "cleanup" | "disabled" | AbortController
  retry?: "auto" | "error" | "always" | "never"
  retryInterval?: number
}

export interface DataActions {
  peek: <T>(fn: () => T) => T
  setAll: (value: unknown, filter?: SignalFilterOptions) => void
  toggleAll: (filter?: SignalFilterOptions) => void
  get: (url: string, args?: FetchActionArgs) => Promise<void>
  post: (url: string, args?: FetchActionArgs) => Promise<void>
  put: (url: string, args?: FetchActionArgs) => Promise<void>
  patch: (url: string, args?: FetchActionArgs) => Promise<void>
  delete: (url: string, args?: FetchActionArgs) => Promise<void>
}

export type DataEvent<E extends HTMLOrSVG = HTMLOrSVG> = Omit<Event, "currentTarget" | "target"> &
  DataActions & {
    signals: Record<string, unknown>
    actions: DataActions
    target: HTMLOrSVG
    currentTarget: E
    window: Window & typeof globalThis
  }

type DataFunction<T = unknown, E extends HTMLOrSVG = HTMLOrSVG> = (e: DataEvent<E>) => T
type DataLifecycleFunction<E extends HTMLOrSVG = HTMLOrSVG> = DataFunction<
  unknown | (() => void),
  E
>

// Datastar object types for specific attributes
type DatastarSignalsObject = Record<string, unknown>
type DatastarClassObject<E extends HTMLOrSVG = HTMLOrSVG> = Record<
  string,
  boolean | string | DataFunction<unknown, E>
>
type DatastarAttrObject<E extends HTMLOrSVG = HTMLOrSVG> = Record<
  string,
  string | boolean | number | DataFunction<unknown, E>
>
type DatastarStyleObject<E extends HTMLOrSVG = HTMLOrSVG> = Record<
  string,
  string | number | boolean | null | undefined | DataFunction<unknown, E>
>

/**
 * Datastar attributes for reactive web applications
 *
 * @see https://data-star.dev/reference/attributes
 */
export interface DatastarAttributes<E extends HTMLOrSVG = HTMLOrSVG> {
  // Core attributes that can accept objects (but also strings)
  "data-signals"?: string | DatastarSignalsObject | undefined
  "data-class"?:
    string | DataFunction<DatastarClassObject<E>, E> | DatastarClassObject<E> | undefined
  "data-attr"?: string | DataFunction<DatastarAttrObject<E>, E> | DatastarAttrObject<E> | undefined
  "data-style"?:
    string | DataFunction<DatastarStyleObject<E>, E> | DatastarStyleObject<E> | undefined

  // Boolean/presence attributes (but also strings)
  "data-show"?: string | DataFunction<boolean, E> | boolean | undefined
  "data-ignore"?: string | boolean | undefined
  "data-ignore-morph"?: string | boolean | undefined

  // Attributes that accept function expressions
  "data-bind"?: string | undefined
  "data-computed"?:
    | string
    | DataFunction<unknown, E>
    | Record<string, DataFunction<unknown, E> | Record<string, DataFunction<unknown, E>>>
    | undefined
  "data-effect"?: string | DataLifecycleFunction<E> | undefined
  "data-init"?: string | DataLifecycleFunction<E> | undefined
  "data-indicator"?: string | undefined
  "data-json-signals"?: true | string | undefined
  "data-on"?: string | DataFunction<unknown, E> | undefined
  "data-on-intersect"?: string | DataFunction<unknown, E> | undefined
  "data-on-interval"?: string | DataFunction<unknown, E> | undefined
  "data-on-load"?: string | DataFunction<unknown, E> | undefined
  "data-on-signal-patch"?: string | DataFunction<unknown, E> | undefined
  "data-on-signal-patch-filter"?: string | undefined
  "data-preserve-attr"?: string | undefined
  "data-ref"?: string | undefined
  "data-text"?: string | DataFunction<string | number | boolean, E> | undefined

  // Pro attributes
  "data-animate"?: string | undefined
  "data-custom-validity"?: string | DataFunction<unknown, E> | undefined
  "data-on-raf"?: string | DataFunction<unknown, E> | undefined
  "data-on-resize"?: string | DataFunction<unknown, E> | undefined
  "data-persist"?: string | undefined
  "data-query-string"?: string | undefined
  "data-replace-url"?: string | undefined
  "data-scroll-into-view"?: string | undefined
  "data-view-transition"?: string | undefined

  // Dynamic attributes with suffixes
  [key: `data-class:${string}`]: string | DataFunction<boolean, E> | undefined
  [key: `data-attr:${string}`]:
    string | DataFunction<string | number | boolean | null | undefined, E> | undefined
  [key: `data-style:${string}`]:
    string | DataFunction<string | number | null | undefined, E> | undefined
  [key: `data-computed:${string}`]: string | DataFunction<unknown, E> | undefined
  [key: `data-on:${string}`]: string | DataFunction<unknown, E> | undefined
}
