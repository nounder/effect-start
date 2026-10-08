export interface Cell<E extends Element = Element> {
  /** The same element throughout this cell's lifetime; incoming response roots start detached. */
  readonly target: E
  /** Reads the current shared root. Assignment replaces it and reruns dependent effects. */
  signals: Record<string, any>
  /** Current array item, inherited by descendants of an expanded template. */
  readonly item: any
  /** Zero-based position in the nearest array expansion; undefined outside a row. */
  readonly index: number | undefined
  /** Aborted when the element is removed, its code changes, or the runtime stops. */
  readonly abortSignal: AbortSignal
  /** Moves this element to the first matching destination. Defaults to appending inside it. */
  move(destination: string | Element, position?: "append" | "prepend" | "before" | "after" | "replace"): void
  /** Morphs a destination; inner uses this element's children. Incoming wrappers are one-shot; destination behavior is preserved. */
  morph(destination: string | Element, mode?: "outer" | "inner"): void
  on<K extends keyof HTMLElementEventMap>(
    name: K,
    handler: (event: HTMLElementEventMap[K]) => unknown,
    options?: AddEventListenerOptions | boolean,
  ): () => void
  on(name: string, handler: (event: Event) => unknown, options?: AddEventListenerOptions | boolean): () => void
  effect(fn: () => void | (() => void)): () => void
  /** Coalesces calls, optionally caps unfinished promises, and cancels pending work on disposal. */
  limit<This, Args extends Array<any>>(
    fn: (this: This, ...args: Args) => unknown,
    options:
      & ({ debounce: number; throttle?: never } | { throttle: number; debounce?: never })
      & { concurrency?: number },
  ): (this: This, ...args: Args) => void
  /** Expand a template by array position, or show one instance for a truthy value. A getter tracks reactive reads. */
  expand(source: unknown): () => void
  /** Sends only the supplied body; applies HTML or SSE updates. Other response types reject. */
  request(
    url: string | URL,
    options?: RequestInit & {
      /** Network failures retry by default; error also retries HTTP errors, always also reconnects completed streams. */
      retry?: "auto" | "error" | "always" | "never"
      /** Initial delay in milliseconds; defaults to 1000. SSE retry fields override it. */
      retryInterval?: number
      /** Backoff multiplier; defaults to 2. */
      retryScaler?: number
      /** Maximum backoff delay in milliseconds; defaults to 30000. */
      retryMaxWait?: number
      /** Retries before giving up; defaults to 10 and resets after a successful connection. */
      retryMaxCount?: number
      /** Keeps connections open while the page is hidden; defaults to true for every method. */
      openWhenHidden?: boolean
    },
  ): Promise<void>
}

export type CellFunction<E extends Element = Element> = (cell: Cell<E>) => void | (() => void)

export interface StartOptions {
  signals?: Record<string, any>
  onError?: (error: unknown, target: Element) => void
}

export interface Runtime {
  readonly signals: Record<string, any>
  stop(): void
}
