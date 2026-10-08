const readEvents = async (response, signal, dispatch, onId, onRetry) => {
  if (!response.body || signal.aborted) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let event = ""
  let data = []
  const cancel = () => {
    reader.cancel().catch(() => {})
  }
  signal.addEventListener("abort", cancel, { once: true })
  try {
    while (!signal.aborted) {
      const chunk = await reader.read()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      let match
      while (!signal.aborted && (match = /\r\n|\r|\n/.exec(buffer))) {
        if (!chunk.done && match[0] === "\r" && match.index === buffer.length - 1) break
        const line = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        if (line === "") {
          if (data.length) dispatch(event, data.join("\n"))
          event = ""
          data = []
        } else {
          const colon = line.indexOf(":")
          const field = colon === -1 ? line : line.slice(0, colon)
          const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "")
          if (field === "event") event = value
          else if (field === "data") data.push(value)
          else if (field === "id" && !value.includes("\0")) onId(value)
          else if (field === "retry" && /^\d+$/.test(value)) onRetry(Number(value))
        }
      }
      if (chunk.done) break
    }
  } finally {
    signal.removeEventListener("abort", cancel)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export const createRequest = (target, lifetime, signals, patchElements) => {
  const document = target.ownerDocument
  const window = document.defaultView
  let current

  /** @type {import("../types.ts").Cell["request"]} */
  return async (input, options = {}) => {
    if (lifetime.aborted) return
    current?.abort()
    const controller = new window.AbortController()
    current = controller
    const abort = () => controller.abort()
    lifetime.addEventListener("abort", abort, { once: true })
    options.signal?.addEventListener("abort", abort, { once: true })
    if (options.signal?.aborted) controller.abort()
    const emit = (phase, extra = {}) =>
      target.dispatchEvent(
        new window.CustomEvent("cell:request", {
          bubbles: true,
          detail: { phase, ...extra },
        }),
      )

    let attempt
    const visibility = () => attempt?.abort()
    const method = (options.method ?? "GET").toUpperCase()
    const openWhenHidden = options.openWhenHidden ?? true
    if (!openWhenHidden) document.addEventListener("visibilitychange", visibility)
    const cancelAttempt = () => attempt?.abort()
    controller.signal.addEventListener("abort", cancelAttempt)

    try {
      emit("started")
      const url = new URL(input, document.baseURI)
      const headers = new Headers(options.headers)
      if (!headers.has("Accept")) headers.set("Accept", "text/event-stream, text/html")
      const retry = options.retry ?? "auto"
      const retryScaler = options.retryScaler ?? 2
      const retryMaxWait = options.retryMaxWait ?? 30_000
      const retryMaxCount = options.retryMaxCount ?? 10
      let baseInterval = options.retryInterval ?? 1_000
      let interval = baseInterval
      let retries = 0
      const init = { ...options, method, headers }
      if (options.bodyJson !== undefined) {
        init.body = JSON.stringify(options.bodyJson)
        if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")
      } else if (options.bodyForm !== undefined) {
        const form = options.bodyForm
        if (typeof form.get === "function") {
          init.body = form
        } else if (typeof form.preventDefault === "function") {
          init.body = new window.FormData(form.target, form.submitter)
        } else if (form.nodeType === 1) {
          init.body = new window.FormData(form)
        } else {
          init.body = new window.FormData()
          for (const [name, value] of Object.entries(form)) init.body.append(name, value)
        }
        headers.delete("Content-Type")
      }
      delete init.bodyJson
      delete init.bodyForm
      delete init.retry
      delete init.retryInterval
      delete init.retryScaler
      delete init.retryMaxWait
      delete init.retryMaxCount
      delete init.openWhenHidden

      while (!controller.signal.aborted) {
        if (!openWhenHidden && document.hidden) {
          await new Promise((resolve) => {
            const resume = () => {
              if (document.hidden && !controller.signal.aborted) return
              document.removeEventListener("visibilitychange", resume)
              controller.signal.removeEventListener("abort", resume)
              resolve()
            }
            document.addEventListener("visibilitychange", resume)
            controller.signal.addEventListener("abort", resume)
          })
          if (controller.signal.aborted) return
        }
        attempt = new window.AbortController()
        let retryable = true
        let failure
        try {
          const response = await window.fetch(url, { ...init, signal: attempt.signal })
          if (attempt.signal.aborted) continue
          retryable = false
          if (response.status === 204) return
          if (!response.ok) {
            retryable = (retry === "always" || retry === "error") && response.status >= 400
            await response.body?.cancel()
            throw new Error(`Cell request failed: ${response.status} ${response.statusText}`)
          }
          retries = 0
          interval = baseInterval
          if (method === "HEAD") return
          const contentType = response.headers.get("Content-Type")?.split(";")[0].trim()
          if (contentType === "text/event-stream") {
            retryable = true
            await readEvents(response, attempt.signal, (event, data) => {
              retryable = false
              if (event === "datastar-patch-elements") patchElements(data)
              else if (event === "datastar-patch-signals") {
                const patch = JSON.parse(data)
                signals.patch(patch.signals, patch.onlyIfMissing ?? false)
              }
              retryable = true
            }, (id) => {
              if (id) headers.set("Last-Event-ID", id)
              else headers.delete("Last-Event-ID")
            }, (value) => {
              baseInterval = interval = value
            })
            if (attempt.signal.aborted) continue
            if (retry !== "always") return
          } else if (contentType === "text/html") {
            const html = await response.text()
            if (attempt.signal.aborted) continue
            patchElements(html)
            return
          } else {
            await response.body?.cancel()
            throw new TypeError(`Unsupported cell response: ${contentType ?? "missing Content-Type"}`)
          }
        } catch (error) {
          if (attempt.signal.aborted) continue
          if (!retryable || retry === "never") throw error
          failure = error
        }
        if (controller.signal.aborted) return
        if (retries >= retryMaxCount) {
          emit("retries-failed")
          throw new Error("Cell request reached maximum retries", { cause: failure })
        }
        retries++
        emit("retrying", { attempt: retries, delay: interval, error: failure })
        await new Promise((resolve) => {
          const done = () => {
            window.clearTimeout(timer)
            attempt.signal.removeEventListener("abort", done)
            resolve()
          }
          const timer = window.setTimeout(done, interval)
          attempt.signal.addEventListener("abort", done, { once: true })
          if (attempt.signal.aborted) done()
        })
        interval = Math.min(interval * retryScaler, retryMaxWait)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        emit("error", { error })
        throw error
      }
    } finally {
      document.removeEventListener("visibilitychange", visibility)
      controller.signal.removeEventListener("abort", cancelAttempt)
      attempt?.abort()
      lifetime.removeEventListener("abort", abort)
      options.signal?.removeEventListener("abort", abort)
      if (current === controller) current = undefined
      emit("finished", { aborted: controller.signal.aborted })
    }
  }
}
