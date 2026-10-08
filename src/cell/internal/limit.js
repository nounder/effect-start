export const createLimit = (fn, options, window, onError) => {
  if (typeof fn !== "function") throw new TypeError("cell.limit requires a function")
  if (!options || typeof options !== "object") throw new TypeError("cell.limit requires options")
  const debounce = options.debounce !== undefined
  if (debounce === (options.throttle !== undefined)) {
    throw new TypeError("Provide exactly one of debounce or throttle")
  }
  const wait = debounce ? options.debounce : options.throttle
  if (!Number.isFinite(wait) || wait < 0 || wait > 2_147_483_647) {
    throw new RangeError("Duration must be between 0 and 2147483647 milliseconds")
  }
  const concurrency = options.concurrency === undefined ? Infinity : options.concurrency
  if (options.concurrency !== undefined && (!Number.isInteger(concurrency) || concurrency < 1)) {
    throw new RangeError("Concurrency must be a positive integer")
  }

  let timer
  let pending
  let active = 0
  let stopped = false

  const complete = () => {
    active--
    drain()
  }

  const fail = (error) => {
    try {
      onError(error)
    } finally {
      complete()
    }
  }

  const expire = () => {
    timer = undefined
    drain()
  }

  const drain = () => {
    // A timer represents either the debounce quiet period or the throttle cooldown.
    if (stopped || !pending || timer !== undefined || active >= concurrency) return
    const call = pending
    pending = undefined
    active++
    if (!debounce) timer = window.setTimeout(expire, wait)
    try {
      const result = fn.apply(call.receiver, call.args)
      if (result && typeof result.then === "function") {
        Promise.resolve(result).then(complete, fail)
        return
      }
    } catch (error) {
      fail(error)
      return
    }
    complete()
  }

  return {
    run(...args) {
      if (stopped) return
      pending = { args, receiver: this }
      if (debounce) {
        window.clearTimeout(timer)
        timer = window.setTimeout(expire, wait)
      } else {
        drain()
      }
    },
    stop() {
      stopped = true
      window.clearTimeout(timer)
      timer = undefined
      pending = undefined
    },
  }
}
