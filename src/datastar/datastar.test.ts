import { JSDOM } from "jsdom"
import * as test from "bun:test"
import { html } from "../hyper/html.ts"
import type { HtmlString } from "../hyper/html.ts"

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost" })
const _window = dom.window

const globals = [
  "document",
  "window",
  "navigator",
  "MutationObserver",
  "HTMLElement",
  "SVGElement",
  "Event",
  "CustomEvent",
  "Node",
  "NodeList",
  "HTMLCollection",
  "DOMParser",
  "XMLSerializer",
  "Element",
  "DocumentFragment",
  "Text",
  "Comment",
  "HTMLInputElement",
  "HTMLSelectElement",
  "HTMLFormElement",
  "HTMLButtonElement",
  "HTMLAnchorElement",
  "HTMLDivElement",
  "HTMLSpanElement",
  "HTMLPreElement",
  "HTMLHtmlElement",
  "HTMLBodyElement",
  "HTMLHeadElement",
  "HTMLTemplateElement",
  "HTMLScriptElement",
  "HTMLTextAreaElement",
] as const

for (const key of globals) {
  Object.defineProperty(globalThis, key, {
    value: (_window as any)[key],
    writable: true,
    configurable: true,
  })
}

if (typeof globalThis.MathMLElement === "undefined") {
  ;(globalThis as any).MathMLElement = class MathMLElement extends (_window as any).HTMLElement {}
}

await import("./index.ts")

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

const setSignals = async (signals: Record<string, any>) => {
  const el = document.createElement("div")
  el.setAttribute("data-signals", JSON.stringify(signals))
  document.body.appendChild(el)
  await tick()
}

const mount = async (markup: string | HtmlString) => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  container.innerHTML = typeof markup === "string" ? markup : markup.value
  await tick()
  return container
}

const cleanup = () => {
  document.body.innerHTML = ""
}

test.describe("signals", () => {
  test.beforeEach(cleanup)

  test.it("initializes from object expression", async () => {
    const c = await mount(html`
      <div data-signals="{count: 0, name: 'alice'}">
        <span id="count" data-text="$count"></span>
        <span id="name" data-text="$name"></span>
      </div>
    `)

    test.expect(c.querySelector("#count")!.textContent).toBe("0")
    test.expect(c.querySelector("#name")!.textContent).toBe("alice")
  })

  test.it("initializes with key form", async () => {
    const c = await mount(html`
      <div>
        <div data-signals:my-val="42"></div>
        <span data-text="$myVal"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("42")
  })

  test.it("ifmissing does not overwrite existing", async () => {
    const c = await mount(html`
      <div>
        <div data-signals="{existing: 'keep'}"></div>
        <div data-signals__ifmissing="{existing: 'overwrite', fresh: 'new'}"></div>
        <span id="existing" data-text="$existing"></span>
        <span id="fresh" data-text="$fresh"></span>
      </div>
    `)

    test.expect(c.querySelector("#existing")!.textContent).toBe("keep")
    test.expect(c.querySelector("#fresh")!.textContent).toBe("new")
  })

  test.it("ifmissing with function form and __ifmissing modifier", async () => {
    const c = await mount(html`
      <div>
        <div data-signals="{ifmExisting: 'keep'}"></div>
        <div data-signals__ifmissing="() => ({ifmExisting: 'overwrite', ifmFresh: 'new'})"></div>
        <span id="existing" data-text="$ifmExisting"></span>
        <span id="fresh" data-text="$ifmFresh"></span>
      </div>
    `)

    test.expect(c.querySelector("#existing")!.textContent).toBe("keep")
    test.expect(c.querySelector("#fresh")!.textContent).toBe("new")
  })

  test.it("initializes nested objects", async () => {
    const c = await mount(html`
      <div data-signals="{user: {name: 'bob', age: 30}}">
        <span id="name" data-text="$user.name"></span>
        <span id="age" data-text="$user.age"></span>
      </div>
    `)

    test.expect(c.querySelector("#name")!.textContent).toBe("bob")
    test.expect(c.querySelector("#age")!.textContent).toBe("30")
  })

  test.it("initializes from function expression and stays reactive", async () => {
    const c = await mount(html`
      <div data-signals="() => ({fnCount: 10, fnName: 'eve'})">
        <span id="count" data-text="$fnCount"></span>
        <span id="name" data-text="$fnName"></span>
      </div>
    `)

    test.expect(c.querySelector("#count")!.textContent).toBe("10")
    test.expect(c.querySelector("#name")!.textContent).toBe("eve")

    await setSignals({ fnCount: 99 })

    test.expect(c.querySelector("#count")!.textContent).toBe("99")
  })

  test.it("initializes with key form function expression and stays reactive", async () => {
    const c = await mount(html`
      <div>
        <div data-signals:fn-val="() => 99"></div>
        <span data-text="$fnVal"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("99")

    await setSignals({ fnVal: 200 })

    test.expect(c.querySelector("span")!.textContent).toBe("200")
  })

  test.it("deletes keys set to null via data-signals", async () => {
    const c = await mount(html`
      <div data-signals="{toDelete: 'exists'}">
        <pre data-json-signals=""></pre>
      </div>
    `)

    test.expect(JSON.parse(c.querySelector("pre")!.textContent || "{}").toDelete).toBe("exists")

    await setSignals({ toDelete: null })

    test.expect(JSON.parse(c.querySelector("pre")!.textContent || "{}").toDelete).toBeUndefined()
  })
})

test.describe("text", () => {
  test.beforeEach(cleanup)

  test.it("renders signal value as text content", async () => {
    const c = await mount(html`
      <div data-signals="{greeting: 'hello'}">
        <span data-text="$greeting"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("hello")
  })

  test.it("updates reactively", async () => {
    const c = await mount(html`
      <div data-signals="{textLabel: 'before'}">
        <span data-text="$textLabel"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("before")

    await setSignals({ textLabel: "after" })

    test.expect(c.querySelector("span")!.textContent).toBe("after")
  })

  test.it("reads nested signal paths", async () => {
    const c = await mount(html`
      <div data-signals="{person: {first: 'bob'}}">
        <span data-text="$person.first"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("bob")
  })
})

test.describe("show", () => {
  test.beforeEach(cleanup)

  test.it("hides when false, shows when true", async () => {
    const c = await mount(html`
      <div data-signals="{visible: false}">
        <div data-show="$visible"></div>
      </div>
    `)
    const el = c.querySelector("[data-show]") as HTMLElement

    test.expect(el.style.display).toBe("none")

    await setSignals({ visible: true })

    test.expect(el.style.display).not.toBe("none")
  })
})

test.describe("effect", () => {
  test.beforeEach(cleanup)

  test.it("runs expression reactively", async () => {
    const c = await mount(html`
      <div data-signals="{effectCounter: 0, effectDoubled: 0}">
        <div data-effect="$effectDoubled = $effectCounter * 2"></div>
        <span data-text="$effectDoubled"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("0")

    await setSignals({ effectCounter: 5 })

    test.expect(c.querySelector("span")!.textContent).toBe("10")
  })

  test.it("tracks multiple dependencies", async () => {
    const c = await mount(html`
      <div data-signals="{effectA: 1, effectB: 2, effectSum: 0}">
        <div data-effect="$effectSum = $effectA + $effectB"></div>
        <span data-text="$effectSum"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("3")

    await setSignals({ effectA: 10 })

    test.expect(c.querySelector("span")!.textContent).toBe("12")

    await setSignals({ effectB: 20 })

    test.expect(c.querySelector("span")!.textContent).toBe("30")
  })
})

test.describe("computed", () => {
  test.beforeEach(cleanup)

  test.it("creates computed signal with key form", async () => {
    const c = await mount(html`
      <div data-signals="{compA: 2, compB: 3}">
        <div data-computed:comp-sum="(e) => e.signals.compA + e.signals.compB"></div>
        <span data-text="$compSum"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("5")
  })

  test.it("updates when deps change", async () => {
    const c = await mount(html`
      <div data-signals="{compX: 10}">
        <div data-computed:comp-doubled="(e) => e.signals.compX * 2"></div>
        <span data-text="$compDoubled"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("20")

    await setSignals({ compX: 5 })

    test.expect(c.querySelector("span")!.textContent).toBe("10")
  })

  test.it("creates multiple computeds from object", async () => {
    const c = await mount(html`
      <div data-signals="{base: 5}">
        <div data-computed="{double: () => $base * 2, triple: () => $base * 3}"></div>
        <span id="double" data-text="$double"></span>
        <span id="triple" data-text="$triple"></span>
      </div>
    `)

    test.expect(c.querySelector("#double")!.textContent).toBe("10")
    test.expect(c.querySelector("#triple")!.textContent).toBe("15")

    await setSignals({ base: 10 })

    test.expect(c.querySelector("#double")!.textContent).toBe("20")
    test.expect(c.querySelector("#triple")!.textContent).toBe("30")
  })

  test.it("chained computed depends on another computed", async () => {
    const c = await mount(html`
      <div data-signals="{compN: 3}">
        <div data-computed:comp-squared="(e) => e.signals.compN * e.signals.compN"></div>
        <div data-computed:comp-quad="(e) => e.signals.compSquared * e.signals.compSquared"></div>
        <span id="squared" data-text="$compSquared"></span>
        <span id="quad" data-text="$compQuad"></span>
      </div>
    `)

    test.expect(c.querySelector("#squared")!.textContent).toBe("9")
    test.expect(c.querySelector("#quad")!.textContent).toBe("81")

    await setSignals({ compN: 2 })

    test.expect(c.querySelector("#squared")!.textContent).toBe("4")
    test.expect(c.querySelector("#quad")!.textContent).toBe("16")
  })

  test.it("key form works with e.signals syntax", async () => {
    const c = await mount(html`
      <div data-signals="{compP: 4}">
        <div data-computed:comp-cubed="(e) => e.signals.compP ** 3"></div>
        <span data-text="$compCubed"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("64")

    await setSignals({ compP: 2 })

    test.expect(c.querySelector("span")!.textContent).toBe("8")
  })

  // TODO: object form doesn't pass event context to functions,
  // so (e) => e.signals.x doesn't work — only $x shorthand works
  test.it.skip("object form works with e.signals syntax", async () => {
    const c = await mount(html`
      <div data-signals="{compQ: 4}">
        <div data-computed="{compCubed: (e) => e.signals.compQ ** 3}"></div>
        <span data-text="$compCubed"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("64")

    await setSignals({ compQ: 2 })

    test.expect(c.querySelector("span")!.textContent).toBe("8")
  })
})

test.describe("attr", () => {
  test.beforeEach(cleanup)

  test.it("sets and updates attribute from signal", async () => {
    const c = await mount(html`
      <div data-signals="{href: '/foo'}">
        <a data-attr:href="$href"></a>
      </div>
    `)
    const el = c.querySelector("a")!

    test.expect(el.getAttribute("href")).toBe("/foo")

    await setSignals({ href: "/bar" })

    test.expect(el.getAttribute("href")).toBe("/bar")
  })

  test.it("removes attribute when false", async () => {
    const c = await mount(html`
      <div data-signals="{isDisabled: false}">
        <button disabled data-attr:disabled="$isDisabled"></button>
      </div>
    `)

    test.expect(c.querySelector("button")!.hasAttribute("disabled")).toBe(false)
  })

  test.it("sets multiple attributes from object expression", async () => {
    const c = await mount(html`
      <div data-signals="{myId: 'test-id', myTitle: 'tip'}">
        <div data-attr="({id: $myId, title: $myTitle})"></div>
      </div>
    `)
    const el = c.querySelector("[data-attr]")!

    test.expect(el.getAttribute("id")).toBe("test-id")
    test.expect(el.getAttribute("title")).toBe("tip")
  })

  test.it("serializes object values as JSON", async () => {
    const c = await mount(html`
      <div data-signals="{config: {x: 1}}">
        <div id="cfg" data-attr:data-config="$config"></div>
      </div>
    `)

    test.expect(c.querySelector("#cfg")!.getAttribute("data-config")).toBe('{"x":1}')
  })
})

test.describe("class", () => {
  test.beforeEach(cleanup)

  test.it("toggles class from signal", async () => {
    const c = await mount(html`
      <div data-signals="{active: false}">
        <div id="cls" data-class:active="$active"></div>
      </div>
    `)
    const el = c.querySelector("#cls")!

    test.expect(el.classList.contains("active")).toBe(false)

    await setSignals({ active: true })

    test.expect(el.classList.contains("active")).toBe(true)
  })

  test.it("handles multiple classes from object expression", async () => {
    const c = await mount(html`
      <div data-signals="{showBold: true, showItalic: false}">
        <div data-class="({bold: $showBold, italic: $showItalic})"></div>
      </div>
    `)
    const el = c.querySelector("[data-class]")!

    test.expect(el.classList.contains("bold")).toBe(true)
    test.expect(el.classList.contains("italic")).toBe(false)
  })

  test.it("toggles space-separated classes", async () => {
    const c = await mount(html`
      <div data-signals="{multi: true}">
        <div data-class="({'font-bold text-red': $multi})"></div>
      </div>
    `)
    const el = c.querySelector("[data-class]")!

    test.expect(el.classList.contains("font-bold")).toBe(true)
    test.expect(el.classList.contains("text-red")).toBe(true)

    await setSignals({ multi: false })

    test.expect(el.classList.contains("font-bold")).toBe(false)
  })
})

test.describe("style", () => {
  test.beforeEach(cleanup)

  test.it("sets and updates style property", async () => {
    const c = await mount(html`
      <div data-signals="{fontSize: '12px'}">
        <div id="styled" data-style:font-size="$fontSize"></div>
      </div>
    `)
    const el = c.querySelector("#styled") as HTMLElement

    test.expect(el.style.fontSize).toBe("12px")

    await setSignals({ fontSize: "20px" })

    test.expect(el.style.fontSize).toBe("20px")
  })

  test.it("sets multiple styles from object", async () => {
    const c = await mount(html`
      <div data-signals="{w: '100px', h: '50px'}">
        <div data-style="({width: $w, height: $h})"></div>
      </div>
    `)
    const el = c.querySelector("[data-style]") as HTMLElement

    test.expect(el.style.width).toBe("100px")
    test.expect(el.style.height).toBe("50px")
  })
})

test.describe("on", () => {
  test.beforeEach(cleanup)

  test.it("handles click and increments counter", async () => {
    const c = await mount(html`
      <div data-signals="{clicks: 0}">
        <button data-on:click="$clicks = $clicks + 1"></button>
        <span data-text="$clicks"></span>
      </div>
    `)
    const btn = c.querySelector("button")!
    const span = c.querySelector("span")!
    btn.click()
    btn.click()
    btn.click()

    test.expect(span.textContent).toBe("3")
  })

  test.it("supports function form", async () => {
    let clicked = false
    ;(globalThis as any).__testClick = () => {
      clicked = true
    }
    const c = await mount(
      html`
        <button data-on:click="() => __testClick()"></button>
      `,
    )
    c.querySelector("button")!.click()

    test.expect(clicked).toBe(true)

    delete (globalThis as any).__testClick
  })

  test.it("prevent modifier prevents default", async () => {
    const c = await mount(html`
      <div data-signals="{submitted: false}">
        <form>
          <button type="submit" data-on:click__prevent="$submitted = true"></button>
        </form>
        <span data-text="$submitted"></span>
      </div>
    `)
    c.querySelector("button")!.click()

    test.expect(c.querySelector("span")!.textContent).toBe("true")
  })

  test.it("stop modifier stops propagation", async () => {
    const c = await mount(html`
      <div data-signals="{parentClicked: false, childClicked: false}">
        <div data-on:click="$parentClicked = true">
          <button data-on:click__stop="$childClicked = true"></button>
        </div>
        <span id="child" data-text="$childClicked"></span>
        <span id="parent" data-text="$parentClicked"></span>
      </div>
    `)
    c.querySelector("button")!.click()

    test.expect(c.querySelector("#child")!.textContent).toBe("true")
    test.expect(c.querySelector("#parent")!.textContent).toBe("false")
  })

  test.it("once modifier fires only once", async () => {
    const c = await mount(html`
      <div data-signals="{onceCount: 0}">
        <button data-on:click__once="$onceCount = $onceCount + 1"></button>
        <span data-text="$onceCount"></span>
      </div>
    `)
    const btn = c.querySelector("button")!
    btn.click()
    btn.click()
    btn.click()

    test.expect(c.querySelector("span")!.textContent).toBe("1")
  })

  test.it("outside modifier fires on clicks outside", async () => {
    const c = await mount(html`
      <div data-signals="{outsideClicked: false}">
        <div data-on:click__outside="$outsideClicked = true"></div>
        <span data-text="$outsideClicked"></span>
      </div>
    `)
    document.body.click()

    test.expect(c.querySelector("span")!.textContent).toBe("true")
  })

  test.it("window modifier listens on window", async () => {
    const c = await mount(html`
      <div data-signals="{windowEvent: false}">
        <div data-on:custom-evt__window="$windowEvent = true"></div>
        <span data-text="$windowEvent"></span>
      </div>
    `)
    window.dispatchEvent(new Event("custom-evt"))

    test.expect(c.querySelector("span")!.textContent).toBe("true")
  })

  test.it("function form with config object (once)", async () => {
    let count = 0
    ;(globalThis as any).__testFnOnce = () => {
      count++
    }
    const c = await mount(
      html`
        <button data-on:click="() => __testFnOnce(), { once: true }"></button>
      `,
    )
    const btn = c.querySelector("button")!
    btn.click()
    btn.click()

    test.expect(count).toBe(1)

    delete (globalThis as any).__testFnOnce
  })

  test.it("debounce modifier delays handler", async () => {
    const c = await mount(html`
      <div data-signals="{debounced: 0}">
        <button data-on:click__debounce.50ms="$debounced = $debounced + 1"></button>
        <span data-text="$debounced"></span>
      </div>
    `)
    test.jest.useFakeTimers()
    const btn = c.querySelector("button")!
    btn.click()
    btn.click()
    btn.click()

    test.expect(c.querySelector("span")!.textContent).toBe("0")

    test.jest.advanceTimersByTime(50)

    test.expect(c.querySelector("span")!.textContent).toBe("1")

    test.jest.useRealTimers()
  })

  test.it("throttle modifier limits rate", async () => {
    const c = await mount(html`
      <div data-signals="{throttled: 0}">
        <button data-on:click__throttle.100ms="$throttled = $throttled + 1"></button>
        <span data-text="$throttled"></span>
      </div>
    `)
    const btn = c.querySelector("button")!
    btn.click()

    test.expect(c.querySelector("span")!.textContent).toBe("1")

    btn.click()
    btn.click()

    test.expect(c.querySelector("span")!.textContent).toBe("1")
  })

  test.it("form submit auto-prevents default", async () => {
    const c = await mount(html`
      <div data-signals="{formSubmitted: false}">
        <form data-on:submit="$formSubmitted = true"></form>
        <span data-text="$formSubmitted"></span>
      </div>
    `)
    c.querySelector("form")!.dispatchEvent(new Event("submit"))

    test.expect(c.querySelector("span")!.textContent).toBe("true")
  })
})

test.describe("bind", () => {
  test.beforeEach(cleanup)

  test.it("two-way binds text input (key form)", async () => {
    const c = await mount(html`
      <div data-signals="{inputVal: 'initial'}">
        <input type="text" data-bind:input-val="" />
        <span data-text="$inputVal"></span>
      </div>
    `)
    const el = c.querySelector("input")!

    test.expect(el.value).toBe("initial")

    el.value = "changed"
    el.dispatchEvent(new Event("input"))

    test.expect(c.querySelector("span")!.textContent).toBe("changed")
  })

  test.it("two-way binds text input (value form)", async () => {
    const c = await mount(html`
      <div data-signals="{username: 'alice'}">
        <input type="text" data-bind="username" />
      </div>
    `)

    test.expect(c.querySelector("input")!.value).toBe("alice")
  })

  test.it("binds checkbox", async () => {
    const c = await mount(html`
      <div data-signals="{checked: false}">
        <input type="checkbox" data-bind:checked="" />
        <span data-text="$checked"></span>
      </div>
    `)
    const el = c.querySelector("input")!

    test.expect(el.checked).toBe(false)

    el.checked = true
    el.dispatchEvent(new Event("change"))

    test.expect(c.querySelector("span")!.textContent).toBe("true")
  })

  test.it("binds number input", async () => {
    const c = await mount(html`
      <div data-signals="{age: 25}">
        <input type="number" data-bind:age="" />
        <span data-text="$age"></span>
      </div>
    `)
    const el = c.querySelector("input")!

    test.expect(el.value).toBe("25")

    el.value = "30"
    el.dispatchEvent(new Event("input"))

    test.expect(c.querySelector("span")!.textContent).toBe("30")
  })

  test.it("binds select", async () => {
    const c = await mount(html`
      <div data-signals="{color: 'blue'}">
        <select data-bind:color="">
          <option value="red">red</option>
          <option value="blue">blue</option>
          <option value="green">green</option>
        </select>
      </div>
    `)

    test.expect(c.querySelector("select")!.value).toBe("blue")
  })

  test.it("binds radio buttons", async () => {
    const c = await mount(html`
      <div data-signals="{choice: 'b'}">
        <input type="radio" value="a" data-bind:choice="" />
        <input type="radio" value="b" data-bind:choice="" />
        <input type="radio" value="c" data-bind:choice="" />
        <span data-text="$choice"></span>
      </div>
    `)
    const radios = c.querySelectorAll<HTMLInputElement>("input")

    test.expect(radios[0].checked).toBe(false)
    test.expect(radios[1].checked).toBe(true)
    test.expect(radios[2].checked).toBe(false)

    radios[2].checked = true
    radios[2].dispatchEvent(new Event("change"))

    test.expect(c.querySelector("span")!.textContent).toBe("c")
  })

  test.it("updates element when signal changes", async () => {
    const c = await mount(html`
      <div data-signals="{field: 'old'}">
        <input type="text" data-bind:field="" />
      </div>
    `)
    const el = c.querySelector("input")!

    test.expect(el.value).toBe("old")

    await setSignals({ field: "new" })

    test.expect(el.value).toBe("new")
  })
})

test.describe("ref", () => {
  test.beforeEach(cleanup)

  test.it("stores element reference with key", async () => {
    const c = await mount(html`
      <div data-signals="{hasRef: false}">
        <div data-ref:my-el=""></div>
        <div data-effect="$hasRef = !!$myEl"></div>
        <span data-text="$hasRef"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("true")
  })

  test.it("stores element reference with value", async () => {
    const c = await mount(html`
      <div data-signals="{hasRef: false}">
        <div data-ref="targetEl"></div>
        <div data-effect="$hasRef = !!$targetEl"></div>
        <span data-text="$hasRef"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("true")
  })
})

test.describe("init", () => {
  test.beforeEach(cleanup)

  test.it("runs initialization code", async () => {
    const c = await mount(html`
      <div data-signals="{initialized: false}">
        <div data-init="$initialized = true"></div>
        <span data-text="$initialized"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("true")
  })

  test.it("function form receives event with target element", async () => {
    const c = await mount(html`
      <div data-signals="{initTag: ''}">
        <span data-init="(e) => e.signals.initTag = e.target.tagName"></span>
        <span id="out" data-text="$initTag"></span>
      </div>
    `)

    test.expect(c.querySelector("#out")!.textContent).toBe("SPAN")
  })

  test.it("expression form receives el as the element", async () => {
    const c = await mount(html`
      <div data-signals="{elTag: ''}">
        <span data-init="$elTag = el.tagName"></span>
        <span id="out" data-text="$elTag"></span>
      </div>
    `)

    test.expect(c.querySelector("#out")!.textContent).toBe("SPAN")
  })

  test.it("delay modifier delays initialization", async () => {
    test.jest.useFakeTimers()
    const container = document.createElement("div")
    document.body.appendChild(container)
    container.innerHTML = html`
      <div data-signals="{delayedInit: false}">
        <div data-init__delay.50ms="$delayedInit = true"></div>
        <span data-text="$delayedInit"></span>
      </div>
    `.value
    await Promise.resolve()
    test.jest.advanceTimersByTime(1)

    test.expect(container.querySelector("span")!.textContent).toBe("false")

    test.jest.advanceTimersByTime(50)

    test.expect(container.querySelector("span")!.textContent).toBe("true")

    test.jest.useRealTimers()
  })
})

test.describe("on-interval", () => {
  test.beforeEach(cleanup)

  test.it("runs callback at interval", async () => {
    test.jest.useFakeTimers()
    const container = document.createElement("div")
    document.body.appendChild(container)
    container.innerHTML = html`
      <div data-signals="{ticks: 0}">
        <div data-on-interval__duration.50ms="$ticks = $ticks + 1"></div>
        <span data-text="$ticks"></span>
      </div>
    `.value
    await Promise.resolve()
    test.jest.advanceTimersByTime(1)
    test.jest.advanceTimersByTime(150)

    test.expect(Number(container.querySelector("span")!.textContent)).toBeGreaterThanOrEqual(2)

    test.jest.useRealTimers()
  })

  test.it("fires immediately with leading modifier", async () => {
    const c = await mount(html`
      <div data-signals="{leadingTick: 0}">
        <div data-on-interval__duration.200ms.leading="$leadingTick = $leadingTick + 1"></div>
        <span data-text="$leadingTick"></span>
      </div>
    `)

    test.expect(Number(c.querySelector("span")!.textContent)).toBeGreaterThanOrEqual(1)
  })
})

test.describe("indicator", () => {
  test.beforeEach(cleanup)

  test.it("tracks fetch lifecycle", async () => {
    const c = await mount(html`
      <div>
        <div id="ind" data-indicator:fetching=""></div>
        <span data-text="$fetching"></span>
      </div>
    `)
    const el = c.querySelector("#ind")!

    test.expect(c.querySelector("span")!.textContent).toBe("false")

    document.dispatchEvent(
      new CustomEvent("datastar-fetch", {
        detail: { type: "started", el },
      }),
    )

    test.expect(c.querySelector("span")!.textContent).toBe("true")

    document.dispatchEvent(
      new CustomEvent("datastar-fetch", {
        detail: { type: "finished", el },
      }),
    )

    test.expect(c.querySelector("span")!.textContent).toBe("false")
  })

  test.it("ignores events from other elements", async () => {
    const c = await mount(html`
      <div>
        <div data-indicator:my-loading=""></div>
        <span data-text="$myLoading"></span>
      </div>
    `)
    document.dispatchEvent(
      new CustomEvent("datastar-fetch", {
        detail: { type: "started", el: document.createElement("div") },
      }),
    )

    test.expect(c.querySelector("span")!.textContent).toBe("false")
  })
})

test.describe("json-signals", () => {
  test.beforeEach(cleanup)

  test.it("renders signals as JSON", async () => {
    const c = await mount(html`
      <div data-signals="{jsonX: 1, jsonY: 2}">
        <pre data-json-signals=""></pre>
      </div>
    `)
    const content = JSON.parse(c.querySelector("pre")!.textContent || "{}")

    test.expect(content.jsonX).toBe(1)
    test.expect(content.jsonY).toBe(2)
  })

  test.it("terse mode uses compact JSON", async () => {
    const c = await mount(html`
      <div data-signals="{jsonTerse: 1}">
        <pre data-json-signals__terse=""></pre>
      </div>
    `)

    test.expect(c.querySelector("pre")!.textContent).not.toContain("\n")
  })

  test.it("filters with include regex", async () => {
    const c = await mount(html`
      <div data-signals="{prefix_a: 1, prefix_b: 2, other: 3}">
        <pre data-json-signals="{include: /^prefix/}"></pre>
      </div>
    `)
    const content = JSON.parse(c.querySelector("pre")!.textContent || "{}")

    test.expect(content.prefix_a).toBe(1)
    test.expect(content.prefix_b).toBe(2)
    test.expect(content.other).toBeUndefined()
  })

  test.it("updates reactively", async () => {
    const c = await mount(html`
      <div data-signals="{reactive: 'initial'}">
        <pre data-json-signals=""></pre>
      </div>
    `)
    const el = c.querySelector("pre")!

    test.expect(JSON.parse(el.textContent || "{}").reactive).toBe("initial")

    await setSignals({ reactive: "updated" })

    test.expect(JSON.parse(el.textContent || "{}").reactive).toBe("updated")
  })
})

test.describe("actions", () => {
  test.beforeEach(cleanup)

  test.it("setAll sets all signals", async () => {
    const c = await mount(html`
      <div data-signals="{actA: true, actB: true, actC: true}">
        <button data-on:click="@setAll(false)"></button>
        <pre data-json-signals=""></pre>
      </div>
    `)
    c.querySelector("button")!.click()
    const content = JSON.parse(c.querySelector("pre")!.textContent || "{}")

    test.expect(content.actA).toBe(false)
    test.expect(content.actB).toBe(false)
    test.expect(content.actC).toBe(false)
  })

  test.it("toggleAll toggles boolean signals", async () => {
    const c = await mount(html`
      <div data-signals="{actX: true, actY: false}">
        <button data-on:click="@toggleAll()"></button>
        <pre data-json-signals=""></pre>
      </div>
    `)
    c.querySelector("button")!.click()
    const content = JSON.parse(c.querySelector("pre")!.textContent || "{}")

    test.expect(content.actX).toBe(false)
    test.expect(content.actY).toBe(true)
  })
})

test.describe("data-ignore", () => {
  test.beforeEach(cleanup)

  test.it("ignores elements and children with data-ignore", async () => {
    const c = await mount(html`
      <div data-signals="{shouldNotExist: false, childIgnored: false}">
        <div data-ignore>
          <div data-signals="{shouldNotExist: true}"></div>
          <div data-signals="{childIgnored: true}"></div>
        </div>
        <span id="sne" data-text="$shouldNotExist"></span>
        <span id="ci" data-text="$childIgnored"></span>
      </div>
    `)

    test.expect(c.querySelector("#sne")!.textContent).toBe("false")
    test.expect(c.querySelector("#ci")!.textContent).toBe("false")
  })

  test.it("ignores self but not children with __self", async () => {
    const c = await mount(html`
      <div data-signals="{childOk: false}">
        <div data-ignore__self data-signals="{selfOnly: true}">
          <span data-signals="{childOk: true}"></span>
        </div>
        <pre data-json-signals=""></pre>
      </div>
    `)
    const content = JSON.parse(c.querySelector("pre")!.textContent || "{}")

    test.expect(content.selfOnly).toBeUndefined()
    test.expect(content.childOk).toBe(true)
  })
})

test.describe("watcher: patchSignals", () => {
  test.beforeEach(cleanup)

  test.it("patches signals via datastar-fetch event", async () => {
    const c = await mount(html`
      <div>
        <pre data-json-signals=""></pre>
      </div>
    `)
    document.dispatchEvent(
      new CustomEvent("datastar-fetch", {
        detail: {
          type: "datastar-patch-signals",
          el: document.body,
          argsRaw: { signals: '{"patchedVal": 123}' },
        },
      }),
    )
    const content = JSON.parse(c.querySelector("pre")!.textContent || "{}")

    test.expect(content.patchedVal).toBe(123)
  })

  test.it("patches with onlyIfMissing", async () => {
    const c = await mount(html`
      <div data-signals="{existingVal: 'keep'}">
        <pre data-json-signals=""></pre>
      </div>
    `)
    document.dispatchEvent(
      new CustomEvent("datastar-fetch", {
        detail: {
          type: "datastar-patch-signals",
          el: document.body,
          argsRaw: {
            signals: '{"existingVal": "overwrite", "newVal": "added"}',
            onlyIfMissing: "true",
          },
        },
      }),
    )
    const content = JSON.parse(c.querySelector("pre")!.textContent || "{}")

    test.expect(content.existingVal).toBe("keep")
    test.expect(content.newVal).toBe("added")
  })
})

test.describe("watcher: patchElements", () => {
  test.beforeEach(cleanup)

  const dispatchPatch = (argsRaw: Record<string, string>) => {
    document.dispatchEvent(
      new CustomEvent("datastar-fetch", {
        detail: {
          type: "datastar-patch-elements",
          el: document.body,
          argsRaw,
        },
      }),
    )
  }

  test.it("outer mode replaces target by id", () => {
    const target = document.createElement("div")
    target.id = "patch-outer"
    target.textContent = "old"
    document.body.appendChild(target)
    dispatchPatch({ elements: '<div id="patch-outer">new</div>' })

    test.expect(document.getElementById("patch-outer")?.textContent).toBe("new")

    document.getElementById("patch-outer")?.remove()
  })

  test.it("inner mode replaces children", () => {
    const target = document.createElement("div")
    target.id = "patch-inner"
    target.innerHTML = "<span>old</span>"
    document.body.appendChild(target)
    dispatchPatch({ selector: "#patch-inner", mode: "inner", elements: "<span>new child</span>" })

    test.expect(target.innerHTML).toContain("new child")

    target.remove()
  })

  test.it("remove mode removes target", () => {
    const target = document.createElement("div")
    target.id = "patch-remove"
    document.body.appendChild(target)
    dispatchPatch({ selector: "#patch-remove", mode: "remove", elements: "" })

    test.expect(document.getElementById("patch-remove")).toBeNull()
  })

  test.it("append mode adds to end", () => {
    const target = document.createElement("div")
    target.id = "patch-append"
    target.innerHTML = "<span>first</span>"
    document.body.appendChild(target)
    dispatchPatch({ selector: "#patch-append", mode: "append", elements: "<span>second</span>" })

    test.expect(target.children.length).toBe(2)
    test.expect(target.lastElementChild?.textContent).toBe("second")

    target.remove()
  })

  test.it("prepend mode adds to beginning", () => {
    const target = document.createElement("div")
    target.id = "patch-prepend"
    target.innerHTML = "<span>second</span>"
    document.body.appendChild(target)
    dispatchPatch({ selector: "#patch-prepend", mode: "prepend", elements: "<span>first</span>" })

    test.expect(target.children.length).toBe(2)
    test.expect(target.firstElementChild?.textContent).toBe("first")

    target.remove()
  })
})

test.describe("integration: signals + effect + text", () => {
  test.beforeEach(cleanup)

  test.it("signals drive effects which update text", async () => {
    const c = await mount(html`
      <div data-signals="{intCount: 1, intLabel: ''}">
        <div data-effect="$intLabel = 'Count is ' + $intCount"></div>
        <span data-text="$intLabel"></span>
      </div>
    `)

    test.expect(c.querySelector("span")!.textContent).toBe("Count is 1")

    await setSignals({ intCount: 42 })

    test.expect(c.querySelector("span")!.textContent).toBe("Count is 42")
  })

  test.it("click increments counter and updates display", async () => {
    const c = await mount(html`
      <div data-signals="{n: 0}">
        <button data-on:click="$n = $n + 1"></button>
        <span data-text="$n"></span>
      </div>
    `)
    const btn = c.querySelector("button")!
    const span = c.querySelector("span")!

    test.expect(span.textContent).toBe("0")

    btn.click()

    test.expect(span.textContent).toBe("1")

    btn.click()
    btn.click()

    test.expect(span.textContent).toBe("3")
  })

  test.it("bind + text stay in sync", async () => {
    const c = await mount(html`
      <div data-signals="{syncVal: 'hello'}">
        <input type="text" data-bind:sync-val="" />
        <span data-text="$syncVal"></span>
      </div>
    `)
    const input = c.querySelector("input")!
    const span = c.querySelector("span")!

    test.expect(input.value).toBe("hello")
    test.expect(span.textContent).toBe("hello")

    input.value = "world"
    input.dispatchEvent(new Event("input"))

    test.expect(span.textContent).toBe("world")
  })

  test.it("show + class + style driven by same signal", async () => {
    const c = await mount(html`
      <div data-signals="{intOn: true}">
        <div
          id="target"
          data-show="$intOn"
          data-class:active="$intOn"
          data-style:opacity="$intOn ? '1' : '0'"
        ></div>
      </div>
    `)
    const el = c.querySelector("#target") as HTMLElement

    test.expect(el.style.display).not.toBe("none")
    test.expect(el.classList.contains("active")).toBe(true)
    test.expect(el.style.opacity).toBe("1")

    await setSignals({ intOn: false })

    test.expect(el.style.display).toBe("none")
    test.expect(el.classList.contains("active")).toBe(false)
    test.expect(el.style.opacity).toBe("0")
  })
})
