export const createLimit = <This, Args extends Array<any>, Timer>(
  fn: (this: This, ...args: Args) => unknown,
  options: unknown,
  window: {
    setTimeout(fn: () => void, wait: number): Timer
    clearTimeout(timer: Timer | undefined): void
  },
  onError: (error: unknown) => void,
) => {
  if (typeof fn !== "function") throw new TypeError("cell.limit requires a function")
  if (!options || typeof options !== "object") throw new TypeError("cell.limit requires options")
  const timing = options as { debounce?: number; throttle?: number; concurrency?: number }
  const debounce = timing.debounce !== undefined
  if (debounce === (timing.throttle !== undefined)) {
    throw new TypeError("Provide exactly one of debounce or throttle")
  }
  const wait = debounce ? timing.debounce : timing.throttle
  if (typeof wait !== "number" || !Number.isFinite(wait) || wait < 0 || wait > 2_147_483_647) {
    throw new RangeError("Duration must be between 0 and 2147483647 milliseconds")
  }
  const concurrency = timing.concurrency === undefined ? Infinity : timing.concurrency
  if (timing.concurrency !== undefined && (!Number.isInteger(concurrency) || concurrency < 1)) {
    throw new RangeError("Concurrency must be a positive integer")
  }

  let timer: Timer | undefined
  let pending: { args: Args; receiver: This } | undefined
  let active = 0
  let stopped = false

  const complete = () => {
    active--
    drain()
  }

  const fail = (error: unknown) => {
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
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
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
    run(this: This, ...args: Args) {
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
