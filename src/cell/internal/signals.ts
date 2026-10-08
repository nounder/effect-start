type Subscription = {
  dependencies: Set<Set<Subscription>>
  stopped: boolean
  cleanup: (() => void) | undefined
  run(): void
}

export type Signals = ReturnType<typeof createSignals>

export const createSignals = (initial: Record<string, any> = {}) => {
  const proxies = new WeakMap<object, object>()
  const dependencies = new WeakMap<object, Map<PropertyKey, Set<Subscription>>>()
  const queued = new Set<Subscription>()
  const keys = Symbol("keys")
  let active: Subscription | undefined

  const track = (target: object, key: PropertyKey) => {
    if (!active) return
    let properties = dependencies.get(target)
    if (!properties) dependencies.set(target, properties = new Map())
    let subscribers = properties.get(key)
    if (!subscribers) properties.set(key, subscribers = new Set())
    subscribers.add(active)
    active.dependencies.add(subscribers)
  }

  const notify = (target: object, key: PropertyKey) => {
    for (const subscriber of dependencies.get(target)?.get(key) ?? []) {
      if (queued.has(subscriber)) continue
      queued.add(subscriber)
      queueMicrotask(() => {
        if (queued.delete(subscriber) && !subscriber.stopped) subscriber.run()
      })
    }
  }

  const wrap = <T>(target: T): T => {
    if (!target || typeof target !== "object") return target
    if (proxies.has(target)) return proxies.get(target) as T
    const proxy = new Proxy(target, {
      get(target, key, receiver) {
        track(target, key)
        return wrap(Reflect.get(target, key, receiver))
      },
      set(target, key, value) {
        const existed = Object.hasOwn(target, key)
        const previous = Reflect.get(target, key)
        const length = Array.isArray(target) ? target.length : undefined
        // Define an own property so signal names such as __proto__ remain ordinary data.
        Object.defineProperty(target, key, {
          value,
          writable: true,
          enumerable: key !== "length" || !Array.isArray(target),
          configurable: key !== "length" || !Array.isArray(target),
        })
        if (!existed || !Object.is(previous, value)) notify(target, key)
        if (!existed) notify(target, keys)
        if (Array.isArray(target) && length !== target.length) {
          notify(target, "length")
          notify(target, keys)
          if (target.length < length!) {
            for (const property of dependencies.get(target)?.keys() ?? []) {
              if (typeof property === "string" && /^\d+$/.test(property) && +property >= target.length) {
                notify(target, property)
              }
            }
          }
        }
        return true
      },
      deleteProperty(target, key) {
        const existed = Object.hasOwn(target, key)
        const result = Reflect.deleteProperty(target, key)
        if (result && existed) {
          notify(target, key)
          notify(target, keys)
        }
        return result
      },
      ownKeys(target) {
        track(target, keys)
        return Reflect.ownKeys(target)
      },
      has(target, key) {
        track(target, key)
        return Reflect.has(target, key)
      },
    })
    proxies.set(target, proxy)
    proxies.set(proxy, proxy)
    return proxy
  }

  const root = wrap({ value: wrap(structuredClone(initial)) })

  const effect = (fn: () => void | (() => void), onError: (error: unknown) => void) => {
    const subscription: Subscription = {
      dependencies: new Set(),
      stopped: false,
      cleanup: undefined,
      run() {
        for (const dependency of subscription.dependencies) dependency.delete(subscription)
        subscription.dependencies.clear()
        const previous = active
        active = undefined
        try {
          const cleanup = subscription.cleanup
          subscription.cleanup = undefined
          cleanup?.()
          active = subscription
          const result = fn()
          if (typeof result === "function") subscription.cleanup = result
        } catch (error) {
          onError(error)
        } finally {
          active = previous
        }
      },
    }
    subscription.run()
    return () => {
      if (subscription.stopped) return
      subscription.stopped = true
      queued.delete(subscription)
      for (const dependency of subscription.dependencies) dependency.delete(subscription)
      subscription.dependencies.clear()
      const cleanup = subscription.cleanup
      subscription.cleanup = undefined
      cleanup?.()
    }
  }

  const patch = (source: Record<string, any>, onlyIfMissing = false, target = root.value): void => {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new TypeError("Signal patches must be objects")
    }
    for (const key of Object.keys(source)) {
      const value = source[key]
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (
          !Object.hasOwn(target, key) || !target[key] || typeof target[key] !== "object" || Array
            .isArray(target[key])
        ) {
          if (onlyIfMissing && Object.hasOwn(target, key)) continue
          target[key] = {}
        }
        patch(value, onlyIfMissing, target[key])
      } else if (!onlyIfMissing || !Object.hasOwn(target, key)) {
        target[key] = value
      }
    }
  }

  return {
    get values() {
      return root.value
    },
    set values(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Signals must be an object")
      }
      root.value = wrap(value)
    },
    effect,
    patch,
    reactive: wrap,
    untrack<T>(fn: () => T): T {
      const previous = active
      active = undefined
      try {
        return fn()
      } finally {
        active = previous
      }
    },
  }
}
