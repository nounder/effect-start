import * as test from "bun:test"
import * as TailwindPlugin from "../../src/tailwind/TailwindPlugin.ts"

/**
 * Tailwind v4 scans source files as plain text and extracts every token that
 * looks like a candidate. The compiler later discards tokens that don't map
 * to a real utility, so over-matching here is expected. These tests verify
 * that intended class names ARE present in the result; we don't assert exact
 * equality because incidental tokens (attribute names, identifiers, words in
 * comments, etc.) will also be picked up by design.
 *
 * @see https://tailwindcss.com/docs/detecting-classes-in-source-files
 */

const containsAll = (set: Set<string>, names: ReadonlyArray<string>) => {
  for (const name of names) test.expect(set.has(name)).toBe(true)
}

const containsNone = (set: Set<string>, names: ReadonlyArray<string>) => {
  for (const name of names) test.expect(set.has(name)).toBe(false)
}

test.describe(`${TailwindPlugin.extractClassNames.name}`, () => {
  test.it("Basic HTML class attributes", () => {
    const source = `<div class="bg-red-500 text-white">Hello</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["bg-red-500", "text-white"])
  })

  test.it("Basic JSX className attributes", () => {
    const source = `<div className="flex items-center justify-between">Content</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["flex", "items-center", "justify-between"])
  })

  test.it("Single quotes", () => {
    const source = `<div class='bg-blue-500 hover:bg-blue-600'>Button</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["bg-blue-500", "hover:bg-blue-600"])
  })

  test.it("Template literals in JSX", () => {
    const source = `<div className={\`bg-\${color} text-lg\`}>Dynamic</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["text-lg"])
    // The "bg-" prefix is broken by ${} so it must NOT survive as a token.
    containsNone(result, ["bg-"])
  })

  test.it("JSX with quoted strings", () => {
    const source = `<div className={"p-4 m-2"}>Static in braces</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["p-4", "m-2"])
  })

  test.it("Multi-line attributes", () => {
    const source = `<div
      className="
        grid
        grid-cols-3
        gap-4
      "
    >Grid</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["grid", "grid-cols-3", "gap-4"])
  })

  test.it("Whitespace variations around equals", () => {
    const cases: Array<readonly [string, string]> = [
      [`<div class="text-sm">Normal</div>`, "text-sm"],
      [`<div class ="text-md">Space before</div>`, "text-md"],
      [`<div class= "text-lg">Space after</div>`, "text-lg"],
      [`<div class = "text-xl">Spaces both</div>`, "text-xl"],
    ]

    for (const [source, expected] of cases) {
      const result = TailwindPlugin.extractClassNames(source)
      test.expect(result.has(expected)).toBe(true)
    }
  })

  test.it("Arbitrary value classes", () => {
    const source = `<div className="w-[32px] bg-[#ff0000] text-[1.5rem]">Arbitrary</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["w-[32px]", "bg-[#ff0000]", "text-[1.5rem]"])
  })

  test.it("Fraction classes", () => {
    const source = `<div className="w-1/2 h-3/4">Fractions</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["w-1/2", "h-3/4"])
  })

  test.it("Complex Tailwind classes", () => {
    const source = `<div className="sm:w-1/2 md:w-1/3 lg:w-1/4 hover:bg-gray-100 focus:ring-2">Responsive</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, [
      "sm:w-1/2",
      "md:w-1/3",
      "lg:w-1/4",
      "hover:bg-gray-100",
      "focus:ring-2",
    ])
  })

  test.it("Negative utilities", () => {
    const source = `<div class="-mt-4 -inset-x-2">Negative</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["-mt-4", "-inset-x-2"])
  })

  test.it("Important prefix and suffix", () => {
    const source = `<div class="!flex bg-red-500! [color:red]!">Important</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["!flex", "bg-red-500!", "[color:red]!"])
  })

  test.it("Child variants * and **", () => {
    const source = `<div class="*:flex **:underline">Children</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["*:flex", "**:underline"])
  })

  test.it("Arbitrary variants with selectors", () => {
    const source = `<div class="[&>div]:flex [&[data-state=open]]:hidden">Arbitrary variants</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["[&>div]:flex", "[&[data-state=open]]:hidden"])
  })

  test.it("Container queries with @", () => {
    const source = `<div class="@container @lg:flex @max-md:hidden">Container</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["@container", "@lg:flex", "@max-md:hidden"])
  })

  test.it("Modifiers with /", () => {
    const source = `<div class="bg-red-500/20 bg-red-500/[20%] bg-red-500/(--opacity)">Modifiers</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["bg-red-500/20", "bg-red-500/[20%]", "bg-red-500/(--opacity)"])
  })

  test.it("CSS variable arbitrary values", () => {
    const source = `<div class="bg-(--my-color) text-(--text,red,blue)">Vars</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["bg-(--my-color)", "text-(--text,red,blue)"])
  })

  test.it("Empty class attributes", () => {
    const source = `<div class="" className=''>Empty</div>`
    const result = TailwindPlugin.extractClassNames(source)

    // No utility candidates inside the empty quotes; words like "Empty" are
    // outside any class-y context but still get scanned. Just verify nothing
    // pretends the empty value produced a real candidate.
    containsNone(result, [""])
  })

  test.it("Classes with special characters", () => {
    const source = `<div className="group-hover:text-blue-500 peer-focus:ring-2">Special chars</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["group-hover:text-blue-500", "peer-focus:ring-2"])
  })

  test.it("Classes inside HTML comments are extracted (v4 plain-text scan)", () => {
    const source = `
      <!-- <div class="commented-out">Should still be scanned</div> -->
      <div class="real-class">Should match</div>
    `
    const result = TailwindPlugin.extractClassNames(source)

    // Tailwind v4 doesn't strip comments — both names appear.
    containsAll(result, ["commented-out", "real-class"])
  })

  test.it("Classes inside JS string literals are extracted (v4 plain-text scan)", () => {
    const source = `
      const message = "This class='fake-class' should be picked up";
      <div class="real-class">Real element</div>
    `
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["fake-class", "real-class"])
  })

  test.it("Conditional JSX expressions are scanned", () => {
    const source = `
      <div className={condition ? "conditional-class" : "other-class"}>Conditional</div>
      <div className={\`template-\${variable}\`}>Template</div>
      <div className={getClasses()}>Function call</div>
      <div className="static-class">Static</div>
    `
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["conditional-class", "other-class", "static-class"])
    // Template literal interpolation breaks the prefix.
    containsNone(result, ["template-"])
  })

  test.it("Vue.js bindings are scanned as plain text", () => {
    const source = `
      <div :class="{ 'active': isActive }">Vue object</div>
      <div :class="['base', condition && 'active']">Vue array</div>
      <div class="static-vue-class">Static Vue</div>
    `
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["active", "base", "static-vue-class"])
  })

  test.it("Svelte directives are scanned as plain text", () => {
    const source = `
      <div class:active={condition}>Svelte directive</div>
      <div class="static-svelte-class">Static Svelte</div>
    `
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["static-svelte-class"])
  })

  test.it("Escaped quotes inside arbitrary values", () => {
    const source = `<div class="text-sm before:content-['Hello']">Escaped quotes</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["text-sm", "before:content-['Hello']"])
  })

  test.it("Component names with dots", () => {
    const source = `<Toast.Toast class="toast toast-top toast-center fixed top-8 z-10">Content</Toast.Toast>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["toast", "toast-top", "toast-center", "fixed", "top-8", "z-10"])
  })

  test.it("Complex component names and attributes", () => {
    const source = `
      <My.Component.Name className="flex items-center">Content</My.Component.Name>
      <Component-with-dashes class="bg-red-500">Content</Component-with-dashes>
      <Component123 className="text-lg">Content</Component123>
      <namespace:element class="border-2">XML style</namespace:element>
    `
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["flex", "items-center", "bg-red-500", "text-lg", "border-2"])
  })

  test.it("Conditional JSX with Toast component", () => {
    const source = `{toastParam !== undefined && (
          <Toast.Toast class="toast toast-top toast-center fixed top-8 z-10">
            <div class="alert alert-success">
              <span>
                {toastParam}
              </span>
            </div>
          </Toast.Toast>
        )}`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, [
      "toast",
      "toast-top",
      "toast-center",
      "fixed",
      "top-8",
      "z-10",
      "alert",
      "alert-success",
    ])
  })

  test.it("Template literals with expressions", () => {
    const source = `<div class={\`toast \${props.class ?? ""}\`}>Content</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["toast"])
  })

  test.it("Handles class after JSX arrow-function attributes", () => {
    const source = `
      <button
        id="mic-btn"
        type="button"
        data-on:click={(e) => {
          if (!e.signals.listening) {
            e.window?.["__startListening"]()
            e.signals.listening = true
          }
        }}
        class="btn btn-outline"
        data-attr:class="$listening ? 'hidden' : 'btn btn-outline'"
      >
        Start listening
      </button>
    `
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["btn", "btn-outline"])
  })

  test.it("data-class: extracts the utility part of the attribute name", () => {
    const source = `<div data-class:underline="$active">Link</div>`
    const result = TailwindPlugin.extractClassNames(source)

    test.expect(result.has("underline")).toBe(true)
  })

  test.it("data-class: extracts multiple utilities from separate attributes", () => {
    const source = `<div data-class:underline="$active" data-class:font-bold="$important">Text</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["underline", "font-bold"])
  })

  test.it("data-class: handles modifier prefixes", () => {
    const source = `<div data-class:hover:text-blue-500="$hovered">Hover me</div>`
    const result = TailwindPlugin.extractClassNames(source)

    test.expect(result.has("hover:text-blue-500")).toBe(true)
  })

  test.it("data-class: handles arbitrary values", () => {
    const source = `<div data-class:w-[200px]="$wide">Wide</div>`
    const result = TailwindPlugin.extractClassNames(source)

    test.expect(result.has("w-[200px]")).toBe(true)
  })

  test.it("data-class: combined with regular class attribute", () => {
    const source = `<div class="flex items-center" data-class:hidden="$isHidden">Content</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, ["flex", "items-center", "hidden"])
  })

  test.it("Named group/peer designators on variants", () => {
    const source = `<div class="group-hover/carousel:text-blue-500 peer-focus/form:ring-2 group-data-[x]/sidebar:hidden">Named groups</div>`
    const result = TailwindPlugin.extractClassNames(source)

    containsAll(result, [
      "group-hover/carousel:text-blue-500",
      "peer-focus/form:ring-2",
      "group-data-[x]/sidebar:hidden",
    ])
  })

  test.it("Template-literal interpolation invalidates surrounding bracket content", () => {
    const source = `<div class={\`bg-[\${color}]\`}>Bad</div>`
    const result = TailwindPlugin.extractClassNames(source)

    // bg-[${color}] has a $ inside the brackets, which v4 treats as invalid.
    containsNone(result, ["bg-[${color}]"])
  })
})
