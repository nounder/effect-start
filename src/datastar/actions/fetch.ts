import {
  action,
  DATASTAR_FETCH_EVENT,
  filtered,
  startPeeking,
  stopPeeking,
  type DatastarFetchEvent,
  type HTMLOrSVG,
  type SignalFilterOptions,
} from "../engine.ts"
import { kebab } from "../utils.ts"

const createHttpMethod = (
  name: string,
  method: string,
  openWhenHiddenDefault: boolean = true,
): void =>
  action({
    name,
    apply: async (
      { el, evt, error, cleanups },
      url: string,
      {
        selector,
        headers: userHeaders,
        contentType = "json",
        filterSignals: { include = /.*/, exclude = /(^|\.)_/ } = {},
        openWhenHidden = openWhenHiddenDefault,
        payload,
        requestCancellation = "auto",
        retry = "auto",
        retryInterval = 1_000,
        retryScaler = 2,
        retryMaxWaitMs = 30_000,
        retryMaxCount = 10,
      }: FetchArgs = {},
    ) => {
      const controller =
        requestCancellation instanceof AbortController ? requestCancellation : new AbortController()
      if (requestCancellation === "auto") {
        cleanups.get(`@${name}`)?.()
        cleanups.set(`@${name}`, async () => {
          controller.abort()
          await Promise.resolve()
        })
      }

      let cleanupFn: (() => void) | null = null

      try {
        if (!url?.length) {
          throw error("FetchNoUrlProvided", { action })
        }

        const initialHeaders: Record<string, any> = {
          Accept: "text/event-stream, text/html, application/json",
          "Datastar-Request": true,
        }
        if (contentType === "json") {
          initialHeaders["Content-Type"] = "application/json"
        }
        const headers = Object.assign({}, initialHeaders, userHeaders)

        const req: FetchEventSourceInit = {
          method,
          headers,
          openWhenHidden,
          retry,
          retryInterval,
          retryScaler,
          retryMaxWaitMs,
          retryMaxCount,
          signal: controller.signal,
          onopen: async (response: Response) => {
            if (response.status >= 400) {
              dispatchFetch(ERROR, el, { status: response.status.toString() })
            }
          },
          onmessage: (evt) => {
            if (!evt.event.startsWith("datastar")) return
            const type = evt.event
            const argsRawLines: Record<string, Array<string>> = {}

            for (const line of evt.data.split("\n")) {
              const i = line.indexOf(" ")
              const k = line.slice(0, i)
              const v = line.slice(i + 1)
              ;(argsRawLines[k] ||= []).push(v)
            }

            const argsRaw = Object.fromEntries(
              Object.entries(argsRawLines).map(([k, v]) => [k, v.join("\n")]),
            )

            dispatchFetch(type, el, argsRaw)
          },
          onerror: (error) => {
            if (isWrongContent(error)) {
              throw error("FetchExpectedTextEventStream", { url })
            }
            if (error) {
              console.error(error.message)
              dispatchFetch(RETRYING, el, { message: error.message })
            }
          },
        }

        const urlInstance = new URL(url, document.baseURI)
        const queryParams = new URLSearchParams(urlInstance.search)

        if (contentType === "json") {
          startPeeking()
          payload = payload !== undefined ? payload : filtered({ include, exclude })
          stopPeeking()
          const body = JSON.stringify(payload)
          if (method === "GET") {
            queryParams.set("datastar", body)
          } else {
            req.body = body
          }
        } else if (contentType === "form") {
          const formEl = (
            selector ? document.querySelector(selector) : el.closest("form")
          ) as HTMLFormElement
          if (!formEl) {
            throw error("FetchFormNotFound", { action, selector })
          }

          if (!formEl.noValidate && !formEl.checkValidity()) {
            formEl.reportValidity()
            return
          }

          const formData = new FormData(formEl)
          let submitter = el as HTMLElement | null

          if (el === formEl && evt instanceof SubmitEvent) {
            submitter = evt.submitter
          } else {
            const preventDefault = (evt: Event) => evt.preventDefault()
            formEl.addEventListener("submit", preventDefault)
            cleanupFn = () => {
              formEl.removeEventListener("submit", preventDefault)
            }
          }

          if (submitter instanceof HTMLButtonElement) {
            const name = submitter.getAttribute("name")
            if (name) formData.append(name, submitter.value)
          }

          const multipart = formEl.getAttribute("enctype") === "multipart/form-data"
          if (!multipart) {
            headers["Content-Type"] = "application/x-www-form-urlencoded"
          }

          const formParams = new URLSearchParams(formData as any)
          if (method === "GET") {
            for (const [key, value] of formParams) {
              queryParams.append(key, value)
            }
          } else if (multipart) {
            req.body = formData
          } else {
            req.body = formParams
          }
        } else {
          throw error("FetchInvalidContentType", { action, contentType })
        }

        dispatchFetch(STARTED, el, {})
        urlInstance.search = queryParams.toString()

        try {
          await fetchEventSource(urlInstance.toString(), el, req)
        } catch (e: any) {
          if (!isWrongContent(e)) {
            throw error("FetchFailed", { method, url, error: e.message })
          }
        }
      } finally {
        dispatchFetch(FINISHED, el, {})
        cleanupFn?.()
        cleanups.delete(`@${name}`)
      }
    },
  })

createHttpMethod("get", "GET", false)
createHttpMethod("patch", "PATCH")
createHttpMethod("post", "POST")
createHttpMethod("put", "PUT")
createHttpMethod("delete", "DELETE")

export const STARTED = "started"
export const FINISHED = "finished"
export const ERROR = "error"
export const RETRYING = "retrying"
export const RETRIES_FAILED = "retries-failed"

const dispatchFetch = (type: string, el: HTMLOrSVG, argsRaw: Record<string, string>) =>
  document.dispatchEvent(
    new CustomEvent<DatastarFetchEvent>(DATASTAR_FETCH_EVENT, {
      detail: { type, el, argsRaw },
    }),
  )

const isWrongContent = (err: any) => `${err}`.includes("text/event-stream")

type ResponseOverrides =
  | {
      selector?: string
      mode?: string
      namespace?: string
      useViewTransition?: boolean
    }
  | {
      onlyIfMissing?: boolean
    }

export type FetchArgs = {
  selector?: string
  headers?: Record<string, string>
  contentType?: "json" | "form"
  filterSignals?: SignalFilterOptions
  openWhenHidden?: boolean
  payload?: any
  requestCancellation?: "auto" | "disabled" | AbortController
  responseOverrides?: ResponseOverrides
  retry?: "auto" | "error" | "always" | "never"
  retryInterval?: number
  retryScaler?: number
  retryMaxWaitMs?: number
  retryMaxCount?: number
}

interface EventSourceMessage {
  id: string
  event: string
  data: string
  retry?: number
}

const getBytes = async (
  stream: ReadableStream<Uint8Array>,
  onChunk: (arr: Uint8Array) => void,
): Promise<void> => {
  const reader = stream.getReader()
  let result = await reader.read()
  while (!result.done) {
    onChunk(result.value)
    result = await reader.read()
  }
}

const getLines = (onLine: (line: Uint8Array, fieldLength: number) => void) => {
  let buffer: Uint8Array | undefined
  let position: number
  let fieldLength: number
  let discardTrailingNewline = false

  return (arr: Uint8Array) => {
    if (!buffer) {
      buffer = arr
      position = 0
      fieldLength = -1
    } else {
      buffer = concat(buffer, arr)
    }

    const bufLength = buffer.length
    let lineStart = 0
    while (position < bufLength) {
      if (discardTrailingNewline) {
        if (buffer[position] === 10) lineStart = ++position
        discardTrailingNewline = false
      }

      let lineEnd = -1
      for (; position < bufLength && lineEnd === -1; ++position) {
        switch (buffer[position]) {
          case 58:
            if (fieldLength === -1) {
              fieldLength = position - lineStart
            }
            break
          // @ts-expect-error:7029
          // biome-ignore lint/suspicious/noFallthroughSwitchClause: intentional fallthrough for CR to LF
          case 13:
            discardTrailingNewline = true
          case 10:
            lineEnd = position
            break
        }
      }

      if (lineEnd === -1) break

      onLine(buffer.subarray(lineStart, lineEnd), fieldLength)
      lineStart = position
      fieldLength = -1
    }

    if (lineStart === bufLength) buffer = undefined
    else if (lineStart) {
      buffer = buffer.subarray(lineStart)
      position -= lineStart
    }
  }
}

const getMessages = (
  onId: (id: string) => void,
  onRetry: (retry: number) => void,
  onMessage?: (msg: EventSourceMessage) => void,
): ((line: Uint8Array, fieldLength: number) => void) => {
  let message = newMessage()
  const decoder = new TextDecoder()

  return (line, fieldLength) => {
    if (!line.length) {
      onMessage?.(message)
      message = newMessage()
    } else if (fieldLength > 0) {
      const field = decoder.decode(line.subarray(0, fieldLength))
      const valueOffset = fieldLength + (line[fieldLength + 1] === 32 ? 2 : 1)
      const value = decoder.decode(line.subarray(valueOffset))

      switch (field) {
        case "data":
          message.data = message.data ? `${message.data}\n${value}` : value
          break
        case "event":
          message.event = value
          break
        case "id":
          onId((message.id = value))
          break
        case "retry": {
          const retry = +value
          if (!Number.isNaN(retry)) {
            onRetry((message.retry = retry))
          }
          break
        }
      }
    }
  }
}

const concat = (a: Uint8Array, b: Uint8Array) => {
  const res = new Uint8Array(a.length + b.length)
  res.set(a)
  res.set(b, a.length)
  return res
}

const newMessage = (): EventSourceMessage => ({
  data: "",
  event: "",
  id: "",
  retry: undefined,
})

type FetchEventSourceInit = RequestInit & {
  headers?: Record<string, string>
  onopen?: (response: Response) => Promise<void>
  onmessage?: (ev: EventSourceMessage) => void
  onclose?: () => void
  onerror?: (err: any) => number | null | undefined | void
  openWhenHidden?: boolean
  fetch?: typeof fetch
  retry?: "auto" | "error" | "always" | "never"
  retryInterval?: number
  retryScaler?: number
  retryMaxWaitMs?: number
  retryMaxCount?: number
  responseOverrides?: ResponseOverrides
}

const fetchEventSource = (
  input: RequestInfo,
  el: HTMLOrSVG,
  {
    signal: inputSignal,
    headers: inputHeaders,
    onopen: inputOnOpen,
    onmessage,
    onclose,
    onerror,
    openWhenHidden,
    fetch: inputFetch,
    retry = "auto",
    retryInterval = 1_000,
    retryScaler = 2,
    retryMaxWaitMs = 30_000,
    retryMaxCount = 10,
    responseOverrides,
    ...rest
  }: FetchEventSourceInit,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const headers: Record<string, string> = {
      ...inputHeaders,
    }

    let curRequestController: AbortController
    const onVisibilityChange = () => {
      curRequestController.abort()
      if (!document.hidden) create()
    }

    if (!openWhenHidden) {
      document.addEventListener("visibilitychange", onVisibilityChange)
    }

    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const dispose = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      clearTimeout(retryTimer)
      curRequestController.abort()
    }

    inputSignal?.addEventListener("abort", () => {
      dispose()
      resolve()
    })

    const fetch = inputFetch || window.fetch
    const onopen = inputOnOpen || (() => {})

    let retries = 0
    let baseRetryInterval = retryInterval
    const create = async () => {
      curRequestController = new AbortController()
      const curRequestSignal = curRequestController.signal
      try {
        const response = await fetch(input, {
          ...rest,
          headers,
          signal: curRequestSignal,
        })

        await onopen(response)

        const dispatchNonSSE = async (
          dispatchType: string,
          response: Response,
          name: string,
          responseOverrides?: ResponseOverrides,
          ...argNames: Array<string>
        ) => {
          const argsRaw: Record<string, string> = {
            [name]: await response.text(),
          }
          for (const n of argNames) {
            let v = response.headers.get(`datastar-${kebab(n)}`)
            if (responseOverrides) {
              const o = (responseOverrides as any)[n]
              if (o) v = typeof o === "string" ? o : JSON.stringify(o)
            }
            if (v) argsRaw[n] = v
          }

          dispatchFetch(dispatchType, el, argsRaw)
          dispose()
          resolve()
        }

        const status = response.status
        const isNoContentStatus = status === 204
        const isRedirectStatus = status >= 300 && status < 400
        const isErrorStatus = status >= 400 && status < 600

        if (status !== 200) {
          onclose?.()
          if (
            retry !== "never" &&
            !isNoContentStatus &&
            !isRedirectStatus &&
            (retry === "always" || (retry === "error" && isErrorStatus))
          ) {
            clearTimeout(retryTimer)
            retryTimer = setTimeout(create, retryInterval)
            return
          }
          dispose()
          resolve()
          return
        }

        retries = 0
        retryInterval = baseRetryInterval

        const ct = response.headers.get("Content-Type")
        if (ct?.includes("text/html")) {
          return await dispatchNonSSE(
            "datastar-patch-elements",
            response,
            "elements",
            responseOverrides,
            "selector",
            "mode",
            "namespace",
            "useViewTransition",
            "namespace",
          )
        }

        if (ct?.includes("application/json")) {
          return await dispatchNonSSE(
            "datastar-patch-signals",
            response,
            "signals",
            responseOverrides,
            "onlyIfMissing",
          )
        }

        if (ct?.includes("text/javascript")) {
          const script = document.createElement("script")
          const scriptAttributesHeader = response.headers.get("datastar-script-attributes")

          if (scriptAttributesHeader) {
            for (const [name, value] of Object.entries(JSON.parse(scriptAttributesHeader))) {
              script.setAttribute(name, value as string)
            }
          }
          script.textContent = await response.text()
          document.head.appendChild(script)
          dispose()
          return
        }

        await getBytes(
          response.body!,
          getLines(
            getMessages(
              (id) => {
                if (id) {
                  headers["last-event-id"] = id
                } else {
                  delete headers["last-event-id"]
                }
              },
              (retry) => {
                baseRetryInterval = retryInterval = retry
              },
              onmessage,
            ),
          ),
        )

        onclose?.()

        if (retry === "always" && !isRedirectStatus) {
          clearTimeout(retryTimer)
          retryTimer = setTimeout(create, retryInterval)
          return
        }

        dispose()
        resolve()
      } catch (err) {
        if (!curRequestSignal.aborted) {
          try {
            const interval: any = onerror?.(err) || retryInterval
            clearTimeout(retryTimer)
            retryTimer = setTimeout(create, interval)
            retryInterval = Math.min(retryInterval * retryScaler, retryMaxWaitMs)
            if (++retries >= retryMaxCount) {
              dispatchFetch(RETRIES_FAILED, el, {})
              dispose()
              reject("Max retries reached.")
            } else {
              console.error(
                `Datastar failed to reach ${input.toString()} retrying in ${interval}ms.`,
              )
            }
          } catch (innerErr) {
            dispose()
            reject(innerErr)
          }
        }
      }
    }

    create()
  })
}
