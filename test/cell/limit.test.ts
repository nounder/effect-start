import * as test from "bun:test"
import { Html } from "effect-start"
import { morph, start } from "effect-start/cell"
import type { Cell, Runtime } from "effect-start/cell"
import { jsx } from "effect-start/jsx-runtime"
import { JSDOM } from "jsdom"
import { createLimit } from "../../src/cell/internal/limit.js"

test.describe("limiter", () => {
  let limits: Array<ReturnType<typeof createLimit>>
  let errors: Array<unknown>

  const deferred = () => {
    let resolve!: () => void
    let reject!: (error: unknown) => void
    const promise = new Promise<void>((yes, no) => {
      resolve = yes
      reject = no
    })
    return { promise, resolve, reject }
  }

  const limit = (fn: (...args: Array<any>) => unknown, options: unknown) => {
    const limiter = createLimit(fn, options, globalThis, (error) => errors.push(error))
    limits.push(limiter)
    return limiter.run
  }

  test.beforeEach(() => {
    test.jest.useFakeTimers({ now: 0 })
    limits = []
    errors = []
  })

  test.afterEach(() => {
    for (const limiter of limits) limiter.stop()
    const timers = test.jest.getTimerCount()
    test.jest.useRealTimers()

    test
      .expect(timers)
      .toBe(0)
    test
      .expect(errors)
      .toEqual([])
  })

  test.it("debounce restarts the quiet period and invokes with the latest arguments and receiver", () => {
    const calls: Array<unknown> = []
    const run = limit(function(this: { name: string }, ...args: Array<unknown>) {
      calls.push([Date.now(), this.name, args])
      return "ignored"
    }, { debounce: 300 })
    run.call({ name: "first" }, 1)
    test.jest.advanceTimersByTime(299)
    const returned = run.call({ name: "last" }, 2, "latest")
    test.jest.advanceTimersByTime(299)

    test
      .expect([calls, returned, test.jest.getTimerCount()])
      .toEqual([[], undefined, 1])

    test.jest.advanceTimersByTime(1)

    test
      .expect(calls)
      .toEqual([[599, "last", [2, "latest"]]])
    test
      .expect(test.jest.getTimerCount())
      .toBe(0)
  })

  test.it("continuous calls postpone debounce until the final quiet period", () => {
    const calls: Array<number> = []
    const run = limit((value) => calls.push(value), { debounce: 300 })
    for (let value = 0; value < 20; value++) {
      run(value)
      test.jest.advanceTimersByTime(100)
    }

    test
      .expect(calls)
      .toEqual([])

    test.jest.advanceTimersByTime(200)

    test
      .expect(calls)
      .toEqual([19])
  })

  test.it("throttle runs immediately, keeps the latest trailing call, and resumes immediately after idle", () => {
    const calls: Array<unknown> = []
    const run = limit((value) => calls.push([Date.now(), value]), { throttle: 100 })
    run("first")
    test.jest.advanceTimersByTime(20)
    run("discarded")
    test.jest.advanceTimersByTime(50)
    run("latest")
    test.jest.advanceTimersByTime(29)

    test
      .expect(calls)
      .toEqual([[0, "first"]])

    test.jest.advanceTimersByTime(1)
    run("next")
    test.jest.advanceTimersByTime(100)
    test.jest.advanceTimersByTime(1000)
    run("after idle")

    test
      .expect(calls)
      .toEqual([[0, "first"], [100, "latest"], [200, "next"], [1200, "after idle"]])
  })

  test.it("an isolated throttled call with no arguments never gets a duplicate trailing invocation", () => {
    let calls = 0
    const run = limit(() => {
      calls++
    }, { throttle: 100 })
    run()
    test.jest.advanceTimersByTime(1000)

    test
      .expect([calls, test.jest.getTimerCount()])
      .toEqual([1, 0])
  })

  test.it("zero debounce defers and coalesces, while zero throttle retains its leading call", () => {
    const debounced: Array<number> = []
    const throttled: Array<number> = []
    const debounce = limit((value) => debounced.push(value), { debounce: 0 })
    const throttle = limit((value) => throttled.push(value), { throttle: 0 })
    for (let value = 1; value <= 3; value++) {
      debounce(value)
      throttle(value)
    }

    test
      .expect([debounced, throttled])
      .toEqual([[], [1]])

    test.jest.advanceTimersByTime(1)

    test
      .expect([debounced, throttled])
      .toEqual([[3], [1, 3]])
  })

  test.it("debounce with concurrency two keeps the latest waiting call and restarts its quiet period", async () => {
    const calls: Array<unknown> = []
    const jobs: Array<ReturnType<typeof deferred>> = []
    const run = limit((value) => {
      calls.push([Date.now(), value])
      const job = deferred()
      jobs.push(job)
      return job.promise
    }, { debounce: 300, concurrency: 2 })
    run("A")
    test.jest.advanceTimersByTime(400)
    run("B")
    test.jest.advanceTimersByTime(400)
    run("C")
    test.jest.advanceTimersByTime(400)

    test
      .expect(calls)
      .toEqual([[300, "A"], [700, "B"]])
    test
      .expect(test.jest.getTimerCount())
      .toBe(0)

    run("D")
    test.jest.advanceTimersByTime(200)
    jobs[1].resolve()
    await jobs[1].promise

    test
      .expect(calls)
      .toEqual([[300, "A"], [700, "B"]])

    test.jest.advanceTimersByTime(100)

    test
      .expect(calls)
      .toEqual([[300, "A"], [700, "B"], [1500, "D"]])

    jobs[0].resolve()
    jobs[2].resolve()
    await Promise.all(jobs.map((job) => job.promise))
  })

  test.it("a debounce whose quiet period ended starts immediately when capacity opens", async () => {
    const job = deferred()
    const calls: Array<unknown> = []
    const run = limit((value) => {
      calls.push([Date.now(), value])
      return value === "first" ? job.promise : undefined
    }, { debounce: 100, concurrency: 1 })
    run("first")
    test.jest.advanceTimersByTime(100)
    run("waiting")
    test.jest.advanceTimersByTime(400)
    job.resolve()
    await job.promise

    test
      .expect(calls)
      .toEqual([[100, "first"], [500, "waiting"]])
  })

  test.it("an early promise completion cannot bypass the throttle cooldown", async () => {
    const job = deferred()
    const calls: Array<unknown> = []
    const run = limit((value) => {
      calls.push([Date.now(), value])
      return value === "first" ? job.promise : undefined
    }, { throttle: 100, concurrency: 1 })
    run("first")
    test.jest.advanceTimersByTime(20)
    run("second")
    job.resolve()
    await job.promise
    test.jest.advanceTimersByTime(79)

    test
      .expect(calls)
      .toEqual([[0, "first"]])

    test.jest.advanceTimersByTime(1)

    test
      .expect(calls)
      .toEqual([[0, "first"], [100, "second"]])
  })

  test.it("throttle measures the next cooldown from the actual start after a capacity wait", async () => {
    const jobs: Array<ReturnType<typeof deferred>> = []
    const calls: Array<unknown> = []
    const run = limit((value) => {
      calls.push([Date.now(), value])
      const job = deferred()
      jobs.push(job)
      return job.promise
    }, { throttle: 100, concurrency: 1 })
    run("A")
    run("B")
    test.jest.advanceTimersByTime(250)

    test
      .expect([calls, test.jest.getTimerCount()])
      .toEqual([[[0, "A"]], 0])

    jobs[0].resolve()
    await jobs[0].promise
    run("C")
    test.jest.advanceTimersByTime(50)
    jobs[1].resolve()
    await jobs[1].promise
    test.jest.advanceTimersByTime(49)

    test
      .expect(calls)
      .toEqual([[0, "A"], [250, "B"]])

    test.jest.advanceTimersByTime(1)

    test
      .expect(calls)
      .toEqual([[0, "A"], [250, "B"], [350, "C"]])

    jobs[2].resolve()
    await jobs[2].promise
  })

  test.it("omitting concurrency permits overlapping promises at the configured pace", () => {
    const calls: Array<number> = []
    const run = limit((value) => {
      calls.push(value)
      return new Promise(() => {})
    }, { throttle: 10 })
    for (let value = 1; value <= 5; value++) {
      run(value)
      test.jest.advanceTimersByTime(10)
    }

    test
      .expect(calls)
      .toEqual([1, 2, 3, 4, 5])
  })

  test.it("synchronous return values release capacity without waiting for a microtask", () => {
    const calls: Array<number> = []
    const run = limit((value) => {
      calls.push(value)
      return { value }
    }, { throttle: 10, concurrency: 1 })
    for (let value = 1; value <= 3; value++) {
      const returned = run(value)

      test
        .expect(returned)
        .toBeUndefined()

      test.jest.advanceTimersByTime(10)
    }

    test
      .expect(calls)
      .toEqual([1, 2, 3])
  })

  test.it("already fulfilled promises release capacity before the next paced invocation", async () => {
    const first = Promise.resolve()
    const calls: Array<number> = []
    const run = limit((value) => {
      calls.push(value)
      return first
    }, { throttle: 10, concurrency: 1 })
    run(1)
    run(2)
    test.jest.advanceTimersByTime(100)

    await first

    test
      .expect(calls)
      .toEqual([1, 2])
  })

  test.it.each([{ debounce: 10 }, { throttle: 10 }])("a synchronous error releases its slot: %j", (timing) => {
    const calls: Array<number> = []
    const failure = new Error("callback failed")
    const run = limit((value) => {
      calls.push(value)
      if (value === 1) throw failure
    }, { ...timing, concurrency: 1 })
    run(1)
    test.jest.advanceTimersByTime(10)
    run(2)
    test.jest.advanceTimersByTime(10)

    test
      .expect(calls)
      .toEqual([1, 2])
    test
      .expect(errors.splice(0))
      .toEqual([failure])
  })

  test.it("a rejection reports once and releases capacity for the latest pending call", async () => {
    const first = deferred()
    const calls: Array<number> = []
    const run = limit((value) => {
      calls.push(value)
      return value === 1 ? first.promise : undefined
    }, { throttle: 10, concurrency: 1 })
    run(1)
    run(2)
    run(3)
    test.jest.advanceTimersByTime(10)
    first.reject(undefined)
    await first.promise.catch(() => {})

    test
      .expect(calls)
      .toEqual([1, 3])
    test
      .expect(errors.splice(0))
      .toEqual([undefined])
  })

  test.it("thenables occupy one slot and multiple settlements cannot release it twice", async () => {
    let resolve!: () => void
    let reject!: (error: unknown) => void
    const second = deferred()
    const thirdStarted = deferred()
    const calls: Array<number> = []
    const run = limit((value) => {
      calls.push(value)
      if (value === 1) {
        return {
          // oxlint-disable-next-line unicorn/no-thenable -- Exercise assimilation of a non-Promise thenable.
          then: (yes, no) => {
            resolve = yes
            reject = no
          },
        }
      }
      if (value === 2) return second.promise
      thirdStarted.resolve()
    }, { throttle: 10, concurrency: 1 })
    run(1)
    await Promise.resolve()
    run(2)
    test.jest.advanceTimersByTime(10)

    test
      .expect(calls)
      .toEqual([1])

    resolve()
    await Promise.resolve()
    run(3)
    test.jest.advanceTimersByTime(10)
    resolve()
    reject(new Error("ignored second settlement"))
    await Promise.resolve()

    test
      .expect(calls)
      .toEqual([1, 2])

    second.resolve()
    await thirdStarted.promise

    test
      .expect(calls)
      .toEqual([1, 2, 3])
  })

  test.it("a throwing then getter is reported and does not leak a slot", () => {
    const failure = new Error("bad then getter")
    let calls = 0
    const run = limit(() => {
      calls++
      if (calls === 1) {
        return {
          // oxlint-disable-next-line unicorn/no-thenable -- Exercise a failure while inspecting a thenable.
          get then() {
            throw failure
          },
        }
      }
    }, { throttle: 10, concurrency: 1 })
    run()
    test.jest.advanceTimersByTime(10)
    run()

    test
      .expect(calls)
      .toBe(2)
    test
      .expect(errors.splice(0))
      .toEqual([failure])
  })

  test.it.each([{ debounce: 10 }, { throttle: 10 }])(
    "reentrant calls retain pacing without recursive invocation: %j",
    (timing) => {
      let depth = 0
      let maxDepth = 0
      const calls: Array<number> = []
      const run = limit((value) => {
        depth++
        maxDepth = Math.max(maxDepth, depth)
        calls.push(value)
        if (value < 3) run(value + 1)
        depth--
      }, { ...timing, concurrency: 1 })
      run(1)
      test.jest.advanceTimersByTime(100)

      test
        .expect([calls, maxDepth])
        .toEqual([[1, 2, 3], 1])
    },
  )

  test.it.each([{ debounce: 10 }, { throttle: 10 }])(
    "stopping cancels pending work and makes the wrapper inert: %j",
    (timing) => {
      const calls: Array<number> = []
      const run = limit((value) => calls.push(value), timing)
      run(1)
      run(2)
      const before = [...calls]
      limits[0].stop()
      limits[0].stop()
      run(3)
      test.jest.advanceTimersByTime(100)

      test
        .expect(calls)
        .toEqual(before)
      test
        .expect(test.jest.getTimerCount())
        .toBe(0)
    },
  )

  test.it("settling or rejecting active work after stopping cannot start pending work", async () => {
    const jobs = [deferred(), deferred()]
    const calls: Array<number> = []
    const failure = new Error("late rejection")
    const run = limit((value) => {
      calls.push(value)
      return jobs[value].promise
    }, { throttle: 10, concurrency: 2 })
    run(0)
    test.jest.advanceTimersByTime(10)
    run(1)
    run(2)
    test.jest.advanceTimersByTime(10)
    limits[0].stop()
    jobs[0].resolve()
    jobs[1].reject(failure)
    await Promise.allSettled(jobs.map((job) => job.promise))
    run(3)
    test.jest.advanceTimersByTime(100)

    test
      .expect(calls)
      .toEqual([0, 1])
    test
      .expect(errors.splice(0))
      .toEqual([failure])
  })

  test.it("separate wrappers have independent timers and concurrency budgets", async () => {
    const first = deferred()
    const calls: Array<string> = []
    const runA = limit(() => {
      calls.push("A")
      return first.promise
    }, { throttle: 10, concurrency: 1 })
    const runB = limit(() => calls.push("B"), { throttle: 10, concurrency: 1 })
    runA()
    runA()
    runB()
    test.jest.advanceTimersByTime(10)
    runB()

    test
      .expect(calls)
      .toEqual(["A", "B", "B"])

    first.resolve()
    await first.promise

    test
      .expect(calls)
      .toEqual(["A", "B", "B", "A"])
  })

  test.it("a large burst while full retains only its latest invocation without polling", async () => {
    const first = deferred()
    const calls: Array<number> = []
    const run = limit((value) => {
      calls.push(value)
      return value === 0 ? first.promise : undefined
    }, { throttle: 10, concurrency: 1 })
    run(0)
    test.jest.advanceTimersByTime(10)
    for (let value = 1; value <= 10_000; value++) run(value)

    test
      .expect([calls, test.jest.getTimerCount()])
      .toEqual([[0], 0])

    first.resolve()
    await first.promise

    test
      .expect(calls)
      .toEqual([0, 10_000])
  })

  test.it("rejects ambiguous timing, invalid durations, and invalid concurrency before scheduling", () => {
    for (
      const options of [
        undefined,
        null,
        {},
        { concurrency: 2 },
        { debounce: 10, throttle: 10 },
        { debounce: -1 },
        { throttle: NaN },
        { debounce: Infinity },
        { throttle: 2_147_483_648 },
        { debounce: "100" },
        { debounce: 10, concurrency: 0 },
        { debounce: 10, concurrency: -1 },
        { debounce: 10, concurrency: 1.5 },
        { debounce: 10, concurrency: Infinity },
        { debounce: 10, concurrency: null },
      ]
    ) {
      test
        .expect(() => limit(() => {}, options))
        .toThrow()
    }

    test
      .expect(() => limit(null as any, { debounce: 10 }))
      .toThrow("requires a function")
    test
      .expect(test.jest.getTimerCount())
      .toBe(0)
  })

  test.it("undefined optional properties behave as absent properties", () => {
    let calls = 0
    const run = limit(() => {
      calls++
    }, { throttle: 10, debounce: undefined, concurrency: undefined })
    run()

    test
      .expect(calls)
      .toBe(1)
  })
})

test.describe("cell integration", () => {
  let dom: JSDOM
  let runtime: Runtime
  let target: HTMLButtonElement
  let cell: Cell<HTMLButtonElement>
  let errors: Array<{ error: unknown; target: Element }>

  test.beforeEach(() => {
    dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" })
    errors = []
    dom.window.document.body.innerHTML = `<button id="owner" data-cell="cell => {
      cell.target.cell = cell
      cell.signals.setups = (cell.signals.setups ?? 0) + 1
    }"></button><section></section>`
    runtime = start(dom.window.document, { onError: (error, target) => errors.push({ error, target }) })
    target = dom.window.document.querySelector("button")!
    cell = (target as any).cell
    test.jest.useFakeTimers({ now: 0 })
  })

  test.afterEach(() => {
    runtime.stop()
    dom.window.close()
    test.jest.useRealTimers()

    test
      .expect(errors)
      .toEqual([])
  })

  test.it("works in serialized markup and receives the latest native event", async () => {
    dom.window.document.querySelector("section")!.innerHTML = Html.text(
      jsx("button", {
        "data-cell": ((cell: Cell<HTMLButtonElement>) => {
          cell.on(
            "click",
            cell.limit((event) => {
              cell.target.textContent = String(event.detail)
            }, { debounce: 100 }),
          )
        })
          .toString(),
      }),
    )
    await Promise.resolve()
    const button = dom.window.document.querySelector("section button")!
    button.dispatchEvent(new dom.window.MouseEvent("click", { detail: 1 }))
    button.dispatchEvent(new dom.window.MouseEvent("click", { detail: 2 }))
    test.jest.advanceTimersByTime(99)

    test
      .expect(button.textContent)
      .toBe("")

    test.jest.advanceTimersByTime(1)

    test
      .expect(button.textContent)
      .toBe("2")
  })

  test.it("preserves parameter, receiver, native event, and void return types", () => {
    const run = cell.limit(function(this: { name: string }, value: number, suffix?: string) {
      return `${this.name}:${value}${suffix ?? ""}`
    }, { debounce: 100, concurrency: 2 })

    test
      .expectTypeOf(run)
      .toEqualTypeOf<(this: { name: string }, value: number, suffix?: string) => void>()

    const asyncRun = cell.limit(async (value: string, ...flags: Array<boolean>) => [value, flags], { throttle: 10 })

    test
      .expectTypeOf(asyncRun)
      .toEqualTypeOf<(this: unknown, value: string, ...flags: Array<boolean>) => void>()

    cell.on(
      "pointermove",
      cell.limit((event) => {
        test
          .expectTypeOf(event)
          .toEqualTypeOf<PointerEvent>()
      }, { throttle: 10 }),
    )

    test
      .expectTypeOf(() => {
        // @ts-expect-error Exactly one timing mode is required.
        cell.limit(() => {}, { concurrency: 2 })
        // @ts-expect-error Debounce and throttle cannot be combined.
        cell.limit(() => {}, { debounce: 100, throttle: 100 })
        // @ts-expect-error Durations are numeric milliseconds.
        cell.limit(() => {}, { debounce: "100" })
        // @ts-expect-error Concurrency must be numeric.
        cell.limit(() => {}, { debounce: 100, concurrency: "2" })
        // @ts-expect-error The returned wrapper preserves its callback's arguments.
        asyncRun(123)
      })
      .toBeFunction()
  })

  test.it("moving a cell preserves its pending debounce and listeners without rerunning setup", async () => {
    const calls: Array<number> = []
    cell.on("click", cell.limit((event) => calls.push(event.detail), { debounce: 100 }))
    target.dispatchEvent(new dom.window.MouseEvent("click", { detail: 1 }))
    test.jest.advanceTimersByTime(40)
    dom.window.document.querySelector("section")!.append(target)
    await Promise.resolve()
    test.jest.advanceTimersByTime(60)

    test
      .expect([calls, runtime.signals.setups, cell.abortSignal.aborted])
      .toEqual([[1], 1, false])

    target.dispatchEvent(new dom.window.MouseEvent("click", { detail: 2 }))
    test.jest.advanceTimersByTime(100)

    test
      .expect(calls)
      .toEqual([1, 2])
  })

  test.it("a morph move preserves active work, pending calls, and the concurrency budget", async () => {
    let resolve!: () => void
    const first = new Promise<void>((done) => {
      resolve = done
    })
    const calls: Array<number> = []
    const run = cell.limit((value: number) => {
      calls.push(value)
      return value === 1 ? first : undefined
    }, { throttle: 100, concurrency: 1 })
    run(1)
    run(2)
    const next = dom.window.document.createElement("template")
    next.innerHTML = `<section>${target.outerHTML}</section>`
    morph(dom.window.document.body, next.content, "inner")
    await Promise.resolve()
    run(3)
    test.jest.advanceTimersByTime(200)

    test
      .expect([calls, runtime.signals.setups, cell.abortSignal.aborted])
      .toEqual([[1], 1, false])
    test
      .expect(dom.window.document.querySelector("section button"))
      .toBe(target)

    resolve()
    await first

    test
      .expect(calls)
      .toEqual([1, 3])
  })

  test.it.each(["remove", "attribute", "code", "stop"])(
    "disposal cancels timers and retained wrappers: %s",
    async (mode) => {
      const calls: Array<string> = []
      const debounce = cell.limit(() => calls.push("debounced"), { debounce: 100 })
      const throttle = cell.limit(() => calls.push("throttled"), { throttle: 100 })
      debounce()
      throttle()
      throttle()
      if (mode === "remove") target.remove()
      else if (mode === "attribute") target.removeAttribute("data-cell")
      else if (mode === "code") target.setAttribute("data-cell", "cell => { cell.target.cell = cell }")
      else runtime.stop()
      await Promise.resolve()
      debounce()
      throttle()
      cell.limit(() => calls.push("created after disposal"), { throttle: 0 })()
      test.jest.advanceTimersByTime(1000)

      test
        .expect(calls)
        .toEqual(["throttled"])
      test
        .expect(cell.abortSignal.aborted)
        .toBe(true)

      if (mode === "code") {
        const replacement = (target as any).cell as Cell
        replacement.limit(() => calls.push("replacement"), { throttle: 0 })()

        test
          .expect(calls)
          .toEqual(["throttled", "replacement"])
      }
    },
  )

  test.it("removing an expanded row cancels its pending callback", async () => {
    runtime.signals.rows = [1]
    dom.window.document.querySelector("section")!.innerHTML = Html.text(
      jsx("template", {
        "data-cell": ((cell: Cell<HTMLTemplateElement>) => cell.expand(() => cell.signals.rows)).toString(),
        children: jsx("button", {
          "data-cell": ((cell: Cell<HTMLButtonElement>) =>
            cell.on(
              "click",
              cell.limit(() => {
                cell.signals.leaked = true
              }, { debounce: 100 }),
            ))
            .toString(),
        }),
      }),
    )
    await Promise.resolve()
    await Promise.resolve()
    dom.window.document.querySelector<HTMLButtonElement>("section button")!.click()
    runtime.signals.rows = []
    await Promise.resolve()
    test.jest.advanceTimersByTime(200)

    test
      .expect(runtime.signals.leaked)
      .toBeUndefined()
    test
      .expect(dom.window.document.querySelector("section button"))
      .toBeNull()
  })

  test.it("moving outside an element runtime disposes the limiter", async () => {
    runtime.stop()
    const scope = dom.window.document.querySelector("section")!
    scope.append(target)
    runtime = start(scope, { onError: (error, target) => errors.push({ error, target }) })
    cell = (target as any).cell
    let calls = 0
    const run = cell.limit(() => {
      calls++
    }, { debounce: 100 })
    run()
    dom.window.document.body.append(target)
    await Promise.resolve()
    test.jest.advanceTimersByTime(100)

    test
      .expect([calls, cell.abortSignal.aborted])
      .toEqual([0, true])
  })

  test.it("pending work cannot restart when a promise resolves after its cell is removed", async () => {
    let resolve!: () => void
    const first = new Promise<void>((done) => {
      resolve = done
    })
    const calls: Array<number> = []
    const run = cell.limit((value: number) => {
      calls.push(value)
      return first
    }, { throttle: 100, concurrency: 1 })
    run(1)
    run(2)
    test.jest.advanceTimersByTime(100)
    target.remove()
    await Promise.resolve()
    resolve()
    await first
    test.jest.advanceTimersByTime(1000)

    test
      .expect(calls)
      .toEqual([1])
  })

  test.it("cross-realm promises keep their slot until completion", async () => {
    let resolve!: () => void
    const first = new dom.window.Promise<void>((done) => {
      resolve = done
    })
    const calls: Array<number> = []
    let started!: () => void
    const secondStarted = new Promise<void>((done) => {
      started = done
    })
    const run = cell.limit((value: number) => {
      calls.push(value)
      if (value === 1) return first
      started()
    }, { throttle: 100, concurrency: 1 })
    run(1)
    run(2)
    test.jest.advanceTimersByTime(100)

    test
      .expect(calls)
      .toEqual([1])

    resolve()
    await secondStarted

    test
      .expect(calls)
      .toEqual([1, 2])
  })

  test.it("callback errors reach onError with the owning element, including delayed rejections", async () => {
    const synchronous = new Error("synchronous failure")
    const asynchronous = new Error("asynchronous failure")
    const first = cell.limit(() => {
      throw synchronous
    }, { debounce: 10 })
    const promise = Promise.reject(asynchronous)
    const second = cell.limit(() => promise, { throttle: 10 })
    first()
    second()
    await promise.catch(() => {})
    test.jest.advanceTimersByTime(10)

    test
      .expect(errors.splice(0))
      .toEqual([{ error: asynchronous, target }, { error: synchronous, target }])
  })

  test.it("a failed setup disposes an already scheduled limit callback", async () => {
    target.setAttribute(
      "data-cell",
      `cell => {
      cell.limit(() => { cell.signals.leaked = true }, { debounce: 100 })()
      throw new Error('setup failed')
    }`,
    )
    await Promise.resolve()
    test.jest.advanceTimersByTime(100)

    test
      .expect(runtime.signals.leaked)
      .toBeUndefined()
    test
      .expect(errors.splice(0).map((entry) => [String(entry.error), entry.target]))
      .toEqual([["Error: setup failed", target]])
  })
})
