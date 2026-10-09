import type * as Values from "../internal/Values.ts"

type RequestBody =
  | { body?: RequestInit["body"]; bodyJson?: never; bodyForm?: never }
  | {
    body?: never
    bodyJson: Values.Json
    bodyForm?: never
  }
  | {
    body?: never
    bodyJson?: never
    bodyForm: FormData | HTMLFormElement | SubmitEvent | Record<string, string | Blob>
  }

export interface Cell<E extends Element = Element> {
  readonly target: E
  signals: Record<string, any>
  readonly item: any
  readonly index: number | undefined
  readonly abortSignal: AbortSignal
  on<K extends keyof HTMLElementEventMap>(
    name: K,
    handler: (event: HTMLElementEventMap[K]) => unknown,
    options?: AddEventListenerOptions | boolean,
  ): () => void
  on(name: string, handler: (event: Event) => unknown, options?: AddEventListenerOptions | boolean): () => void
  effect(fn: () => void | (() => void)): () => void
  limit<This, Args extends Array<any>>(
    fn: (this: This, ...args: Args) => unknown,
    options:
      & ({ debounce: number; throttle?: never } | { throttle: number; debounce?: never })
      & { concurrency?: number },
  ): (this: This, ...args: Args) => void
  expand(source: unknown): () => void
  request(
    url: string | URL,
    options?: Omit<RequestInit, "body"> & RequestBody & {
      urlParams?: ConstructorParameters<typeof URLSearchParams>[0]
      retry?: "auto" | "error" | "always" | "never"
      retryInterval?: number
      retryScaler?: number
      retryMaxWait?: number
      retryMaxCount?: number
      openWhenHidden?: boolean
    },
  ): Promise<void>
}

export type CellFunction<E extends Element = Element> = (cell: Cell<E>) => void | (() => void)

type Placement = "append" | "prepend" | "before" | "after" | "replace" | "morph" | "morphChildren"

export type CellDeclaration<E extends Element = Element> =
  | ({ setup?: CellFunction<E> } & { [P in Placement]?: never })
  | {
    [P in Placement]:
      & { [K in P]: string }
      & { [K in Exclude<Placement, P>]?: never }
      & { setup?: CellFunction<P extends "morphChildren" ? Element : E> }
  }[Placement]

export interface StartOptions {
  signals?: Record<string, any>
  onError?: (error: unknown, target: Element) => void
}

export interface Runtime {
  readonly signals: Record<string, any>
  stop(): void
}
