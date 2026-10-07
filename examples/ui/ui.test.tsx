import * as test from "bun:test"
import { Html } from "effect-start"
import * as JSDOM from "jsdom"
import * as RouteHttp from "effect-start/RouteHttp"
import route from "./routes/route.tsx"
import {
  Breadcrumb,
  Carousel,
  Checkbox,
  Combobox,
  ContextMenuTrigger,
  Dialog,
  DialogClose,
  DialogTrigger,
  Drawer,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  NativeSelect,
  Pagination,
  Sheet,
  Slider,
  Switch,
} from "./ui.tsx"

test.it("renders every showcase family with unique element IDs", async () => {
  const response = await RouteHttp.toWebHandler(route)(new Request("http://localhost/"))
  const document = new JSDOM.JSDOM(await response.text())
    .window
    .document
  const ids = Array.from(document.querySelectorAll("[id]"), (element) => element.id)

  test
    .expect(new Set(ids).size)
    .toBe(ids.length)
  test
    .expect(document.querySelectorAll(".preview-surface dialog").length)
    .toBe(4)
  test
    .expect(document.querySelector("#framework-options option")?.getAttribute("value"))
    .toBe("effect-start")
})

test.it("native controls participate in form submission", () => {
  const window = new JSDOM.JSDOM(Html.text(
    <form>
      <Checkbox name="terms" checked value="accepted" />
      <Switch name="updates" checked value="yes" />
      <Slider name="volume" value={65} min={0} max={100} />
      <NativeSelect name="framework">
        <optgroup label="Frameworks">
          <option value="effect">
            effect-start
          </option>
        </optgroup>
      </NativeSelect>
      <Combobox name="language" value="TypeScript" options={["TypeScript", "JavaScript"]} />
    </form>,
  ))
    .window
  const values = new window.FormData(window.document.querySelector("form")!)

  test
    .expect(Object.fromEntries(values))
    .toEqual({
      terms: "accepted",
      updates: "yes",
      volume: "65",
      framework: "effect",
      language: "TypeScript",
    })
})

test.it("dialog commands preserve their target without interpolating it into script", () => {
  const id = "profile's-dialog"
  const document = new JSDOM.JSDOM(Html.text(
    <div>
      <DialogTrigger for={id}>
        Open
      </DialogTrigger>
      <Dialog id={id} aria-label="Edit profile">
        Profile
      </Dialog>
    </div>,
  ))
    .window
    .document
  const trigger = document.querySelector("button")!

  test
    .expect(trigger.getAttribute("commandfor"))
    .toBe(id)
  test
    .expect(trigger.getAttribute("command"))
    .toBe("show-modal")
  test
    .expect(trigger.getAttribute("onclick"))
    .not
    .toContain(id)
  test
    .expect(document.getElementById(id)?.getAttribute("aria-label"))
    .toBe("Edit profile")
})

test.it("menu checkbox updates its accessible and visual state", () => {
  const window = new JSDOM.JSDOM(
    Html.text(
      <DropdownMenuCheckboxItem checked>
        Show status
      </DropdownMenuCheckboxItem>,
    ),
    { runScripts: "dangerously" },
  )
    .window
  const item = window.document.querySelector("button")!
  item.click()

  test
    .expect(item.getAttribute("aria-checked"))
    .toBe("false")
  test
    .expect(item.dataset.state)
    .toBe("unchecked")

  item.click()

  test
    .expect(item.getAttribute("aria-checked"))
    .toBe("true")
  test
    .expect(item.dataset.state)
    .toBe("checked")
})

test.it("menu radio selection clears the previous selection in its group", () => {
  const window = new JSDOM.JSDOM(
    Html.text(
      <DropdownMenuRadioGroup>
        <DropdownMenuRadioItem checked>
          Comfortable
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem>
          Compact
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>,
    ),
    { runScripts: "dangerously" },
  )
    .window
  const items = window.document.querySelectorAll("button")
  items[1]!.click()

  test
    .expect(items[0]!.getAttribute("aria-checked"))
    .toBe("false")
  test
    .expect(items[1]!.getAttribute("aria-checked"))
    .toBe("true")
})

test.it.each([0, 2])("context menu waits until the opening gesture finishes (buttons=%i)", (buttons) => {
  const window = new JSDOM.JSDOM(
    Html.text(
      <div>
        <ContextMenuTrigger for="context-menu">
          Right-click here
        </ContextMenuTrigger>
        <div id="context-menu" popover="auto">
          Actions
        </div>
      </div>,
    ),
  )
    .window
  const pending: Array<() => void> = []
  const menu = window.document.getElementById("context-menu")!
  let opened = false
  menu.showPopover = () => {
    opened = true
  }
  window.setTimeout = ((callback: () => void) => {
    pending.push(callback)
    return 0
  }) as typeof window.setTimeout
  const trigger = window.document.querySelector("[data-context-menu-target]")!
  const script = trigger.querySelector("script")!
  // Bun's VM cannot execute jsdom scripts, so run the emitted script against this test window.
  Object.defineProperty(window.document, "currentScript", { value: script })
  new Function("window", "document", "setTimeout", script.textContent!)(window, window.document, window.setTimeout)
  const event = new window.MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    buttons,
    clientX: 40,
    clientY: 80,
  })
  trigger.dispatchEvent(event)

  test
    .expect(event.defaultPrevented)
    .toBe(true)
  test
    .expect(opened)
    .toBe(false)

  if (buttons) {
    test
      .expect(pending.length)
      .toBe(0)

    window.document.dispatchEvent(new window.MouseEvent("pointerup", { button: 2 }))
  }

  test
    .expect(pending.length)
    .toBe(1)

  pending[0]!()

  test
    .expect(opened)
    .toBe(true)
  test
    .expect(menu.style.left)
    .toBe("40px")
  test
    .expect(menu.style.top)
    .toBe("80px")
})

test.it("drawer handle tracks dragging, restores canceled gestures, and dismisses on a downward drag", () => {
  const window = new JSDOM.JSDOM(Html.text(
    <Drawer id="drawer">
      Contents
    </Drawer>,
  ))
    .window
  const drawer = window.document.querySelector("dialog")!
  const handle = drawer.querySelector<HTMLButtonElement>("[data-slot=Drawer_handle]")!
  const script = drawer.querySelector("script")!
  let captured: number | undefined
  handle.setPointerCapture = (pointer) => {
    captured = pointer
  }
  handle.releasePointerCapture = (pointer) => {
    test.expect(pointer).toBe(captured!)
    captured = undefined
  }
  drawer.close = () => {
    drawer.open = false
    drawer.dispatchEvent(new window.Event("close"))
  }
  Object.defineProperty(window.document, "currentScript", { value: script })
  new Function("window", "document", script.textContent!)(window, window.document)
  const pointer = (type: string, y: number) => {
    const event = new window.MouseEvent(type, { clientY: y, button: 0 })
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
    handle.dispatchEvent(event)
  }
  drawer.open = true
  drawer.style.transform = "scale(1)"
  pointer("pointerdown", 10)
  pointer("pointermove", 40)
  test.expect(captured).toBe(1)
  test.expect(drawer.style.transform).toBe("translateY(30px)")
  pointer("pointerup", 40)
  test.expect(drawer.open).toBe(true)
  test.expect(drawer.style.transform).toBe("scale(1)")
  handle.dispatchEvent(new window.MouseEvent("click", { detail: 1, cancelable: true }))
  test.expect(drawer.open).toBe(true)
  pointer("pointerdown", 10)
  pointer("pointermove", 110)
  pointer("pointercancel", 110)
  test.expect(drawer.open).toBe(true)
  test.expect(drawer.style.transform).toBe("scale(1)")
  pointer("pointerdown", 10)
  pointer("pointermove", 110)
  pointer("pointerup", 110)
  test.expect(drawer.open).toBe(false)
  test.expect(drawer.style.transform).toBe("scale(1)")
  drawer.open = true
  handle.click()
  test.expect(drawer.open).toBe(false)
})

test.it("empty JSX children retain default icons and accessible control names", () => {
  const document = new JSDOM.JSDOM(Html.text(
    <div>
      <DialogClose />
      <Sheet id="settings">
        Settings
      </Sheet>
    </div>,
  ))
    .window
    .document
  const controls = document.querySelectorAll("button,a")
  test.expect(controls.length).toBe(2)
  for (const control of controls) {
    test.expect(control.querySelector("svg")).not.toBeNull()
    test.expect(control.textContent?.trim().length).toBeGreaterThan(0)
  }
  test.expect(document.querySelector("#settings [data-slot=Dialog_close]")?.getAttribute("commandfor")).toBe("settings")
})

test.it("sheet dismisses outside clicks but preserves inside and canceled gestures", () => {
  const window = new JSDOM.JSDOM(Html.text(
    <Sheet id="sheet">
      Content
    </Sheet>,
  ))
    .window
  const sheet = window.document.querySelector("dialog")!
  sheet.getBoundingClientRect = () => new window.DOMRect(100, 0, 200, 300)
  sheet.close = () => {
    sheet.open = false
  }
  const script = sheet.querySelector("script")!
  Object.defineProperty(window.document, "currentScript", { value: script })
  new Function("window", "document", script.textContent!)(window, window.document)
  const pointer = (x: number, button = 0) =>
    sheet.dispatchEvent(new window.MouseEvent("pointerdown", { clientX: x, clientY: 20, button }))
  const click = (x: number) => sheet.dispatchEvent(new window.MouseEvent("click", { clientX: x, clientY: 20 }))
  sheet.open = true
  pointer(150)
  click(50)
  test.expect(sheet.open).toBe(true)
  pointer(50, 2)
  click(50)
  test.expect(sheet.open).toBe(true)
  pointer(50)
  sheet.dispatchEvent(new window.Event("pointercancel"))
  click(50)
  test.expect(sheet.open).toBe(true)
  pointer(50)
  click(50)
  test.expect(sheet.open).toBe(false)
})

test.it("pagination renders mixed labels, current pages, plain content, and disabled links", () => {
  const document = new JSDOM.JSDOM(Html.text(
    <Pagination
      id="results-pages"
      class="justify-start"
      aria-label="Result pages"
      items={[
        { label: "Previous", url: "?before=abc&limit=10", disabled: true },
        { label: 1, url: "?page=1" },
        { label: 2, url: "?page=2", current: true },
        { label: "…" },
        {
          label: (
            <span>
              Next results
            </span>
          ),
          url: "?after=xyz&limit=10",
        },
      ]}
    />,
  ))
    .window
    .document
  const nav = document.querySelector("nav")!
  const items = Array.from(nav.querySelectorAll("li > *"))

  test.expect(nav.id).toBe("results-pages")
  test.expect(nav.getAttribute("aria-label")).toBe("Result pages")
  test.expect(nav.classList.contains("justify-start")).toBe(true)
  test.expect(nav.hasAttribute("items")).toBe(false)
  test.expect(items.map((item) => item.textContent)).toEqual(["Previous", "1", "2", "…", "Next results"])
  test.expect(items[0]!.tagName).toBe("SPAN")
  test.expect(items[0]!.getAttribute("aria-disabled")).toBe("true")
  test.expect(items[0]!.hasAttribute("href")).toBe(false)
  test.expect(items[0]!.hasAttribute("tabindex")).toBe(false)
  test.expect(items[1]!.getAttribute("href")).toBe("?page=1")
  test.expect(items[1]!.hasAttribute("aria-current")).toBe(false)
  test.expect(items[2]!.getAttribute("aria-current")).toBe("page")
  test.expect(items[2]!.getAttribute("data-active")).toBe("true")
  test.expect(items[2]!.classList.contains("border")).toBe(true)
  test.expect(items[3]!.tagName).toBe("SPAN")
  test.expect(items[3]!.hasAttribute("aria-disabled")).toBe(false)
  test.expect(items[4]!.getAttribute("href")).toBe("?after=xyz&limit=10")
  test.expect(items[4]!.querySelector("span")?.textContent).toBe("Next results")
})

test.it("pagination supports cursor-only items and a current page without a URL", () => {
  const document = new JSDOM.JSDOM(Html.text(
    <div>
      <Pagination
        items={[
          { label: "Previous", disabled: true },
          { label: "Next", url: "?after=abc" },
        ]}
      />
      <Pagination items={[{ label: 1, current: true }]} />
      <Pagination items={[]} />
    </div>,
  ))
    .window
    .document
  const navigations = document.querySelectorAll("nav")

  test.expect(navigations[0]!.getAttribute("aria-label")).toBe("Pagination")
  test.expect(navigations[0]!.querySelectorAll("li").length).toBe(2)
  test.expect(navigations[0]!.querySelectorAll("a").length).toBe(1)
  test.expect(navigations[1]!.querySelector("[aria-current=page]")?.tagName).toBe("SPAN")
  test.expect(navigations[2]!.querySelectorAll("li").length).toBe(0)
})

test.it.each([1, 5, 10])("pagination gallery renders navigable links for page %i", async (page) => {
  const response = await RouteHttp.toWebHandler(route)(new Request(`http://localhost/?page=${page}`))
  const document = new JSDOM.JSDOM(await response.text()).window.document
  const nav = document.querySelector("#pagination nav")!
  const items = nav.querySelectorAll("li > *")

  test.expect(response.status).toBe(200)
  test.expect(nav.querySelectorAll("[aria-current=page]").length).toBe(1)
  test.expect(nav.querySelector("[aria-current=page]")?.textContent).toBe(String(page))
  test.expect(items[0]!.getAttribute("href")).toBe(page === 1 ? null : `?page=${page - 1}#pagination`)
  test.expect(items[items.length - 1]!.getAttribute("href")).toBe(page === 10 ? null : `?page=${page + 1}#pagination`)
  const numbers = page === 1 ? [1, 2, 10] : page === 5 ? [1, 4, 5, 6, 10] : [1, 9, 10]
  const numberedLinks = Array.from(nav.querySelectorAll("a")).filter((link) => /^\d+$/.test(link.textContent!))
  test.expect(numberedLinks.map((link) => Number(link.textContent))).toEqual(numbers)
  for (const link of numberedLinks) {
    test.expect(link.getAttribute("href")).toBe(`?page=${link.textContent}#pagination`)
  }
  test
    .expect(Array.from(items).filter((item) => item.tagName === "SPAN" && item.textContent === "…").length)
    .toBe(page === 5 ? 2 : 1)
})

test.it("breadcrumb renders links, text, JSX labels, and an accessible current page", () => {
  const document = new JSDOM.JSDOM(Html.text(
    <Breadcrumb
      id="project-path"
      class="py-2"
      aria-label="Project path"
      items={[
        {
          label: (
            <span>
              Home
            </span>
          ),
          url: "/?view=all&sort=name",
        },
        { label: "…" },
        { label: "Project", current: true },
      ]}
    />,
  ))
    .window
    .document
  const nav = document.querySelector("nav")!
  const items = nav.querySelectorAll("li")
  const current = nav.querySelector("[aria-current=page]")!

  test.expect(nav.id).toBe("project-path")
  test.expect(nav.getAttribute("aria-label")).toBe("Project path")
  test.expect(nav.className).toBe("py-2")
  test.expect(nav.hasAttribute("items")).toBe(false)
  test.expect(Array.from(items, (item) => item.textContent)).toEqual(["Home", "…", "Project"])
  test.expect(nav.querySelector("a")?.getAttribute("href")).toBe("/?view=all&sort=name")
  test.expect(nav.querySelector("a > span")?.textContent).toBe("Home")
  test.expect(nav.querySelector("a")?.hasAttribute("aria-current")).toBe(false)
  test.expect(current.tagName).toBe("SPAN")
  test.expect(current.textContent).toBe("Project")
  test.expect(current.hasAttribute("role")).toBe(false)
  test.expect(current.hasAttribute("aria-disabled")).toBe(false)
  test.expect(items[0]!.querySelector("svg")).toBeNull()
  for (const item of Array.from(items).slice(1)) {
    test.expect(item.firstElementChild?.getAttribute("data-slot")).toBe("Breadcrumb_separator")
    test.expect(item.firstElementChild?.getAttribute("aria-hidden")).toBe("true")
  }
})

test.it.each([0, 1, 4])("breadcrumb generates only the separators needed for %i items", (count) => {
  const document = new JSDOM.JSDOM(Html.text(
    <Breadcrumb
      items={Array.from({ length: count }, (_, index) => ({
        label: index + 1,
        url: `/level/${index + 1}`,
        current: index === count - 1,
      }))}
    />,
  ))
    .window
    .document

  test.expect(document.querySelector("nav")?.getAttribute("aria-label")).toBe("breadcrumb")
  test.expect(document.querySelectorAll("ol > li").length).toBe(count)
  test.expect(document.querySelectorAll("[data-slot=Breadcrumb_separator]").length).toBe(Math.max(0, count - 1))
  test.expect(document.querySelectorAll("a[aria-current=page]").length).toBe(count ? 1 : 0)
})

test.it.each(["horizontal", "vertical"] as const)(
  "carousel updates arrows after layout changes without scrolling (%s)",
  (orientation) => {
    const window = new JSDOM.JSDOM(Html.text(
      <Carousel orientation={orientation} aria-label="Photos" items={["First", "Second", "Third"]} />,
    ))
      .window
    const root = window.document.querySelector<HTMLElement>("[data-slot=Carousel]")!
    const track = root.querySelector<HTMLElement>("[data-slot=Carousel_contentTrack]")!
    const previous = root.querySelector<HTMLButtonElement>("[data-slot=Carousel_previous]")!
    const next = root.querySelector<HTMLButtonElement>("[data-slot=Carousel_next]")!
    const script = root.querySelector("script")!
    let viewport = 0
    let extent = 0
    let resize: () => void = () => {}
    Object.defineProperties(track, {
      clientWidth: { get: () => viewport },
      clientHeight: { get: () => viewport },
      scrollWidth: { get: () => extent },
      scrollHeight: { get: () => extent },
    })
    track.scrollBy = ((options: ScrollToOptions) => {
      track.scrollLeft += options.left ?? 0
      track.scrollTop += options.top ?? 0
      track.dispatchEvent(new window.Event("scroll"))
    }) as typeof track.scrollBy
    Object.defineProperty(window.document, "currentScript", { value: script })
    new Function("window", "document", "ResizeObserver", "Element", script.textContent!)(
      window,
      window.document,
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe() {}
      },
      window.Element,
    )
    test.expect(previous.disabled).toBe(true)
    test.expect(next.disabled).toBe(true)

    viewport = 100
    extent = 300
    resize()
    test.expect(previous.disabled).toBe(true)
    test.expect(next.disabled).toBe(false)
    next.click()
    test.expect(orientation === "vertical" ? track.scrollTop : track.scrollLeft).toBe(100)
    test.expect(previous.disabled).toBe(false)

    root.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: orientation === "vertical" ? "ArrowDown" : "ArrowRight" }),
    )
    test.expect(orientation === "vertical" ? track.scrollTop : track.scrollLeft).toBe(200)
    test.expect(next.disabled).toBe(true)
    previous.click()
    test.expect(orientation === "vertical" ? track.scrollTop : track.scrollLeft).toBe(100)
    test.expect(next.disabled).toBe(false)

    viewport = 300
    track.scrollLeft = 0
    track.scrollTop = 0
    resize()
    test.expect(previous.disabled).toBe(true)
    test.expect(next.disabled).toBe(true)
  },
)

test.it("carousel renders items and custom button content through one component", () => {
  const document = new JSDOM.JSDOM(Html.text(
    <Carousel
      id="photos"
      class="w-80"
      items={[<img src="/one.jpg" alt="First photo" />, "Second photo"]}
      leftButton={
        <span>
          Back
        </span>
      }
      rightButton="Forward"
      aria-label="Photos"
    />,
  ))
    .window
    .document
  const root = document.querySelector("[data-slot=Carousel]")!
  const slides = root.querySelectorAll("[data-slot=Carousel_item]")
  const previous = root.querySelector<HTMLButtonElement>("[data-slot=Carousel_previous]")!
  const next = root.querySelector<HTMLButtonElement>("[data-slot=Carousel_next]")!

  test.expect(root.id).toBe("photos")
  test.expect(root.classList.contains("w-80")).toBe(true)
  test.expect(root.hasAttribute("items")).toBe(false)
  test.expect(root.hasAttribute("leftButton")).toBe(false)
  test.expect(root.hasAttribute("rightButton")).toBe(false)
  test.expect(slides.length).toBe(2)
  test.expect(slides[0]!.querySelector("img")?.alt).toBe("First photo")
  test.expect(slides[1]!.textContent).toBe("Second photo")
  test.expect(slides[1]!.getAttribute("aria-label")).toBe("2 of 2")
  test.expect(previous.querySelector("span")?.textContent).toBe("Back")
  test.expect(next.textContent).toBe("Forward")
  test.expect(previous.getAttribute("aria-label")).toBe("Previous slide")
  test.expect(next.getAttribute("aria-label")).toBe("Next slide")
  test.expect(previous.disabled).toBe(true)
  test.expect(next.disabled).toBe(false)
})

test.it.each([0, 1])("carousel disables navigation when there are %i slides", (count) => {
  const document = new JSDOM.JSDOM(Html.text(
    <Carousel items={Array.from({ length: count }, () => "Only slide")} />,
  ))
    .window
    .document

  test.expect(document.querySelectorAll("button:disabled").length).toBe(2)
  test.expect(document.querySelectorAll("button svg").length).toBe(2)
})

test.it.each([
  { leftButton: null, rightButton: undefined, directions: ["next"] },
  { leftButton: undefined, rightButton: null, directions: ["prev"] },
  { leftButton: null, rightButton: null, directions: [] },
])("carousel omits only buttons explicitly set to null (%j)", (props) => {
  const document = new JSDOM.JSDOM(Html.text(
    <Carousel items={["One", "Two"]} leftButton={props.leftButton} rightButton={props.rightButton} />,
  ))
    .window
    .document
  const buttons = Array.from(document.querySelectorAll("button"))

  test.expect(buttons.map((button) => button.getAttribute("data-carousel-direction"))).toEqual([...props.directions])
  for (const button of buttons) {
    test.expect(button.querySelector("svg")).not.toBeNull()
  }
})
