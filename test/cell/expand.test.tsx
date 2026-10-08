import * as test from "bun:test"
import { Html } from "effect-start"
import { morph, start } from "effect-start/cell"
import type { Cell, Runtime } from "effect-start/cell"
import { JSDOM } from "jsdom"

let dom: JSDOM
let runtime: Runtime
let errors: Array<unknown>

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

test.beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only", pretendToBeVisual: true })
  errors = []
  runtime = start(dom.window.document, { onError: (error) => errors.push(error) })
})

test.afterEach(() => {
  runtime.stop()
  dom.window.close()

  test
    .expect(errors)
    .toEqual([])
})

test.it("expands arrays by position, preserving nodes and setup while item reads stay reactive", async () => {
  runtime.signals.todos = [{ title: "First" }, { title: "Second" }]
  dom.window.document.body.innerHTML = Html.text(
    <ol>
      <template data-cell={(cell) => cell.expand(() => cell.signals.todos)}>
        <li
          data-cell={(cell) => {
            cell.target.dataset.setups = String(Number(cell.target.dataset.setups ?? 0) + 1)
          }}
        >
          <span
            data-cell={(cell) =>
              cell.effect(() => {
                cell.target.textContent = `${cell.index}: ${cell.item.title}`
              })}
          />
          <input />
          <button
            data-cell={(cell) =>
              cell.on("click", () => {
                cell.item.title += "!"
              })}
          />
        </li>
      </template>
    </ol>,
  )
  await tick()
  const document = dom.window.document
  const first = document.querySelector("li")!
  const input = first.querySelector("input")!
  input.value = "local draft"

  test
    .expect(Array.from(document.querySelectorAll("span"), (element) => element.textContent))
    .toEqual(["0: First", "1: Second"])
  test
    .expect(Object.keys(runtime.signals))
    .toEqual(["todos"])

  runtime.signals.todos[0].title = "Edited"
  runtime.signals.todos.push({ title: "Third" })
  await tick()

  test
    .expect(Array.from(document.querySelectorAll("span"), (element) => element.textContent))
    .toEqual(["0: Edited", "1: Second", "2: Third"])

  runtime.signals.todos = [{ title: "Replacement" }, { title: "Remaining" }]
  await tick()
  first.querySelector("button")!.click()
  await tick()

  test
    .expect(document.querySelector("li"))
    .toBe(first)
  test
    .expect([first.dataset.setups, input.value, first.textContent])
    .toEqual(["1", "local draft", "0: Replacement!"])
  test
    .expect(runtime.signals.todos[0].title)
    .toBe("Replacement!")

  runtime.signals.todos.splice(0, 1)
  await tick()

  test
    .expect(document.querySelector("li"))
    .toBe(first)
  test
    .expect(first.textContent)
    .toBe("0: Remaining")
  test
    .expect(document.querySelectorAll("li").length)
    .toBe(1)
})

test.it("renders falsy array items as rows and supports multiple roots and text in a blueprint", async () => {
  runtime.signals.items = [false, null, undefined, 0, ""]
  dom.window.document.body.innerHTML = Html.text(
    <template data-cell={(cell) => cell.expand(() => cell.signals.items)}>
      {"["}
      <span
        data-cell={(cell) =>
          cell.effect(() => {
            cell.target.textContent = String(cell.item)
          })}
      />
      <b
        data-cell={(cell) =>
          cell.effect(() => {
            cell.target.textContent = String(cell.index)
          })}
      />
      {"]"}
    </template>,
  )
  await tick()

  test
    .expect(dom.window.document.body.textContent)
    .toBe("[false0][null1][undefined2][03][4]")

  runtime.signals.items.length = 0
  await tick()

  test
    .expect(dom.window.document.body.textContent)
    .toBe("")
  test
    .expect(dom.window.document.querySelectorAll("span, b").length)
    .toBe(0)
})

test.it("hides every falsy value and empty arrays, and preserves a shown instance across truthy values", async () => {
  dom.window.document.body.innerHTML = Html.text(
    <template data-cell={(cell) => cell.expand(() => cell.signals.show)}>
      <input value="initial" />
    </template>,
  )
  await tick()

  test
    .expect(dom.window.document.querySelector("input"))
    .toBeNull()

  for (const value of [false, null, undefined, 0, -0, 0n, NaN, "", []]) {
    runtime.signals.show = true
    await tick()

    test
      .expect(dom.window.document.querySelector("input"))
      .not
      .toBeNull()

    runtime.signals.show = value
    await tick()

    test
      .expect(dom.window.document.querySelector("input"))
      .toBeNull()
  }

  runtime.signals.show = true
  await tick()
  const input = dom.window.document.querySelector("input")!
  input.value = "keep"
  for (const value of [1, "yes", {}, true]) {
    runtime.signals.show = value
    await tick()

    test
      .expect(dom.window.document.querySelector("input"))
      .toBe(input)
    test
      .expect(input.value)
      .toBe("keep")
  }
})

test.it("conditional templates preserve row scope, while nested arrays introduce their own scope", async () => {
  runtime.signals.todos = [{ title: "First", visible: true, tags: ["a", "b"] }]
  dom.window.document.body.innerHTML = Html.text(
    <template data-cell={(cell) => cell.expand(() => cell.signals.todos.length)}>
      <ol>
        <template data-cell={(cell) => cell.expand(() => cell.signals.todos)}>
          <li>
            <template data-cell={(cell) => cell.expand(() => cell.item.visible)}>
              <span
                data-cell={(cell) =>
                  cell.effect(() => {
                    cell.target.textContent = `${cell.index}: ${cell.item.title}`
                  })}
              />
              <template data-cell={(cell) => cell.expand(() => cell.item.tags)}>
                <b
                  data-cell={(cell) =>
                    cell.effect(() => {
                      cell.target.textContent = `${cell.index}: ${cell.item}`
                    })}
                />
              </template>
            </template>
          </li>
        </template>
      </ol>
    </template>,
  )
  await tick()
  const document = dom.window.document
  const list = document.querySelector("ol")!
  const title = document.querySelector("span")!

  test
    .expect(list.textContent)
    .toBe("0: First0: a1: b")

  runtime.signals.todos[0] = { title: "Updated", visible: true, tags: ["c"] }
  await tick()

  test
    .expect(document.querySelector("span"))
    .toBe(title)
  test
    .expect(list.textContent)
    .toBe("0: Updated0: c")

  runtime.signals.todos[0].visible = false
  await tick()

  test
    .expect(list.textContent)
    .toBe("")
  test
    .expect(document.querySelector("span, b"))
    .toBeNull()

  runtime.signals.todos[0].visible = true
  await tick()

  test
    .expect(list.textContent)
    .toBe("0: Updated0: c")

  runtime.signals.todos = []
  await tick()

  test
    .expect(document.querySelector("ol"))
    .toBeNull()
})

test.it("switching between array and condition modes resets item scope", async () => {
  runtime.signals.value = ["row"]
  dom.window.document.body.innerHTML = Html.text(
    <template data-cell={(cell) => cell.expand(() => cell.signals.value)}>
      <span
        data-cell={(cell) =>
          cell.effect(() => {
            cell.target.textContent = `${cell.item}:${cell.index}`
          })}
      />
    </template>,
  )
  await tick()

  test
    .expect(dom.window.document.body.textContent)
    .toBe("row:0")

  runtime.signals.value = true
  await tick()

  test
    .expect(dom.window.document.body.textContent)
    .toBe("undefined:undefined")

  runtime.signals.value = ["again"]
  await tick()

  test
    .expect(dom.window.document.body.textContent)
    .toBe("again:0")
})

test.it("removing a row disposes nested effects, listeners, requests, and expansion ranges", async () => {
  let requestSignal: AbortSignal | undefined
  dom.window.fetch = ((_url, options) => {
    requestSignal = options?.signal ?? undefined
    return new Promise(() => {})
  }) as typeof fetch
  runtime.signals.rows = ["first", "second"]
  dom.window.document.body.innerHTML = Html.text(
    <template data-cell={(cell) => cell.expand(() => cell.signals.rows)}>
      <template data-cell={(cell) => cell.expand(true)}>
        <button
          data-cell={(cell) => {
            cell.effect(() => {
              cell.target.textContent = cell.item
            })
            cell.on("click", () => {
              cell.signals.clicked = cell.item
              return cell.request("http://localhost/request")
            })
            return () => {
              cell.signals.cleanups = (cell.signals.cleanups ?? 0) + 1
            }
          }}
        />
      </template>
    </template>,
  )
  await tick()
  const buttons = dom.window.document.querySelectorAll("button")
  buttons[1].click()
  runtime.signals.rows.pop()
  await tick()

  test
    .expect(requestSignal?.aborted)
    .toBe(true)
  test
    .expect(runtime.signals.cleanups)
    .toBe(1)
  test
    .expect(dom.window.document.querySelectorAll("button").length)
    .toBe(1)

  runtime.signals.clicked = "unchanged"
  buttons[1].click()
  runtime.signals.rows[0] = "updated"
  await tick()

  test
    .expect(runtime.signals.clicked)
    .toBe("unchanged")
  test
    .expect([buttons[0].textContent, buttons[1].textContent])
    .toEqual(["updated", "second"])

  const template = dom.window.document.querySelector("template")!
  template.remove()
  await tick()

  test
    .expect(runtime.signals.cleanups)
    .toBe(2)
  test
    .expect(dom.window.document.body.childNodes.length)
    .toBe(0)
})

test.it("moves template output with its owner without rerunning nested cells", async () => {
  dom.window.document.body.innerHTML = Html.text(
    <main>
      <section>
        <template data-cell={(cell) => cell.expand(["one", "two"])}>
          <template data-cell={(cell) => cell.expand(true)}>
            <input
              data-cell={(cell) => {
                cell.target.dataset.setups = String(Number(cell.target.dataset.setups ?? 0) + 1)
              }}
            />
          </template>
          <span
            data-cell={(cell) =>
              cell.effect(() => {
                cell.target.textContent = cell.item
              })}
          />
        </template>
      </section>
      <aside />
    </main>,
  )
  await tick()
  const document = dom.window.document
  const template = document.querySelector("template")!
  const input = document.querySelector("input")!
  input.value = "draft"
  document.querySelector("aside")!.append(template)
  await tick()

  test
    .expect(document.querySelector("section")!.childNodes.length)
    .toBe(0)
  test
    .expect(document.querySelector("aside input"))
    .toBe(input)
  test
    .expect([input.dataset.setups, input.value, document.querySelector("aside")!.textContent])
    .toEqual(["1", "draft", "onetwo"])
})

test.it("rebuilds instances after server morphs remove output or change the blueprint", async () => {
  runtime.signals.items = ["one", "two"]
  const markup = Html.text(
    <template id="rows" data-cell={(cell) => cell.expand(() => cell.signals.items)}>
      <span
        data-cell={(cell) =>
          cell.effect(() => {
            cell.target.textContent = cell.item
          })}
      />
    </template>,
  )
  dom.window.document.body.innerHTML = `<main>${markup}<footer>old</footer></main>`
  await tick()
  const document = dom.window.document
  const template = document.querySelector("template")!
  const next = document.createElement("template")
  next.innerHTML = `${markup}<footer>new</footer>`
  morph(document.querySelector("main")!, next.content, "inner")
  await tick()

  test
    .expect(document.querySelector("template"))
    .toBe(template)
  test
    .expect(document.querySelector("main")!.textContent)
    .toBe("onetwonew")

  next.innerHTML = markup.replaceAll("span", "b")
  morph(template, next.content)
  await tick()

  test
    .expect(document.querySelectorAll("span").length)
    .toBe(0)
  test
    .expect(Array.from(document.querySelectorAll("b"), (element) => element.textContent))
    .toEqual(["one", "two"])
  test
    .expect(document.querySelector("footer")!.textContent)
    .toBe("new")
})

test.it("replacing or disposing an expansion removes its output and stop permits a clean restart", async () => {
  const template = dom.window.document.createElement("template")
  template.innerHTML = "<span>shown</span>"
  template.setAttribute("data-cell", "cell => { cell.target.cell = cell; cell.expand(true) }")
  dom.window.document.body.append(template)
  await tick()
  const cell = (template as any).cell as Cell<HTMLTemplateElement>
  const dispose = cell.expand([1, 2])
  await tick()

  test
    .expect(dom.window.document.querySelectorAll("span").length)
    .toBe(2)

  dispose()
  dispose()
  await tick()

  test
    .expect(dom.window.document.body.childNodes.length)
    .toBe(1)

  cell.expand(true)
  template.removeAttribute("data-cell")
  await tick()

  test
    .expect(dom.window.document.body.childNodes.length)
    .toBe(1)

  template.setAttribute("data-cell", "cell => cell.expand(true)")
  await tick()
  runtime.stop()

  test
    .expect(dom.window.document.body.childNodes.length)
    .toBe(1)

  runtime = start(dom.window.document, { onError: (error) => errors.push(error) })
  await tick()

  test
    .expect(dom.window.document.querySelectorAll("span").length)
    .toBe(1)
})

test.it("reports non-template usage and cleans up expansion after a failed setup", async () => {
  dom.window.document.body.innerHTML = Html.text(
    <main>
      <div data-cell={(cell) => cell.expand(true)} />
      <template
        data-cell={(cell) => {
          cell.expand(true)
          throw new Error("failed setup")
        }}
      >
        <span>
          removed
        </span>
      </template>
    </main>,
  )
  await tick()

  test
    .expect(errors.map(String))
    .toEqual(["TypeError: cell.expand requires a <template> element", "Error: failed setup"])

  errors.length = 0

  test
    .expect(dom.window.document.querySelector("span"))
    .toBeNull()
})
