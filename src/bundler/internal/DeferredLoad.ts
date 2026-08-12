/**
 * Emulates Bun's `onLoad` `defer()` on bundlers that don't support it
 * natively (esbuild, Rolldown). A deferring call stops counting as "active"
 * and waits until every other `onLoad` call tracked by the same tracker has
 * settled, then every waiter resumes together.
 *
 * This approximates, but doesn't exactly match, Bun's guarantee that a
 * deferred callback resumes only after the *entire* parse pass completes: it
 * resumes once every `onLoad` call that was active through the same tracker
 * has settled, which depends on how much of the module graph the bundler has
 * discovered by that point.
 */
export interface DeferredLoadTracker {
  readonly wrapLoad: <A>(run: () => Promise<A>) => Promise<A>
  readonly defer: () => Promise<void>
}

export function makeDeferredLoadTracker(): DeferredLoadTracker {
  let active = 0
  let waiters: Array<() => void> = []

  const release = () => {
    if (active > 0 || waiters.length === 0) return
    const toRelease = waiters
    waiters = []
    active += toRelease.length
    for (const resolve of toRelease) resolve()
  }

  const wrapLoad = async <A>(run: () => Promise<A>): Promise<A> => {
    active++
    try {
      return await run()
    } finally {
      active--
      release()
    }
  }

  const defer = () => {
    active--
    return new Promise<void>((resolve) => {
      waiters.push(resolve)
      release()
    })
  }

  return { wrapLoad, defer }
}
