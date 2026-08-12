import * as test from "bun:test"
import * as DeferredLoad from "../../src/bundler/internal/DeferredLoad.ts"

test.it("defer() resolves immediately when no other load is in flight", async () => {
  const tracker = DeferredLoad.makeDeferredLoadTracker()

  const order: Array<string> = []
  await tracker.wrapLoad(async () => {
    order.push("start")
    await tracker.defer()
    order.push("resumed")
  })

  test
    .expect(order)
    .toEqual(["start", "resumed"])
})

test.it("defer() waits for other in-flight loads to settle before resuming", async () => {
  const tracker = DeferredLoad.makeDeferredLoadTracker()
  const order: Array<string> = []

  let releaseSibling: () => void
  const siblingGate = new Promise<void>((resolve) => {
    releaseSibling = resolve
  })

  const deferring = tracker.wrapLoad(async () => {
    order.push("deferring:start")
    // Yield once so the sibling load (started synchronously right after
    // this call) has a chance to register as active before we defer.
    await Promise.resolve()
    await tracker.defer()
    order.push("deferring:resumed")
  })

  const sibling = tracker.wrapLoad(async () => {
    order.push("sibling:start")
    await siblingGate
    order.push("sibling:done")
  })

  await new Promise((resolve) => setTimeout(resolve, 10))
  test
    .expect(order)
    .toEqual(["deferring:start", "sibling:start"])

  releaseSibling!()
  await Promise.all([deferring, sibling])

  test
    .expect(order)
    .toEqual(["deferring:start", "sibling:start", "sibling:done", "deferring:resumed"])
})

test.it("multiple deferred loads resume together once the last in-flight load settles", async () => {
  const tracker = DeferredLoad.makeDeferredLoadTracker()
  const resumed: Array<string> = []

  let releaseBlocker: () => void
  const blockerGate = new Promise<void>((resolve) => {
    releaseBlocker = resolve
  })

  const blocker = tracker.wrapLoad(() => blockerGate.then(() => {}))
  const a = tracker.wrapLoad(async () => {
    await Promise.resolve()
    await tracker.defer()
    resumed.push("a")
  })
  const b = tracker.wrapLoad(async () => {
    await Promise.resolve()
    await tracker.defer()
    resumed.push("b")
  })

  await new Promise((resolve) => setTimeout(resolve, 10))
  test
    .expect(resumed)
    .toEqual([])

  releaseBlocker!()
  await Promise.all([blocker, a, b])

  test
    .expect(resumed.sort())
    .toEqual(["a", "b"])
})
