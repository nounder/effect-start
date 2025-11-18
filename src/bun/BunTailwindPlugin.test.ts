import * as t from "bun:test"

import { extractClassNames } from "./BunTailwindPlugin.ts"

// Keep the old broad implementation for comparison tests
function extractClassNamesBroad(source: string): Set<string> {
  // Old broad implementation
  const CLASS_NAME_REGEX = /^[^"'`\s]+$/
  const classTokenRegex =
    /\b[a-zA-Z][a-zA-Z0-9_:-]*(?:\[[^\]]*\])?(?:\/[0-9]+)?/g

  return new Set(
    Array
      .from(source.matchAll(classTokenRegex))
      .map(match => match[0])
      .filter(token => CLASS_NAME_REGEX.test(token)),
  )
}

t.describe("extractClassNames", () => {
  t.test("Basic HTML class attributes", () => {
    const source = `<div class="bg-red-500 text-white">Hello</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["bg-red-500", "text-white"])
  })

  t.test("Basic JSX className attributes", () => {
    const source =
      `<div className="flex items-center justify-between">Content</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["flex", "items-center", "justify-between"])
  })

  t.test("Single quotes", () => {
    const source = `<div class='bg-blue-500 hover:bg-blue-600'>Button</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["bg-blue-500", "hover:bg-blue-600"])
  })

  t.test("Template literals in JSX", () => {
    const source = `<div className={\`bg-\${color} text-lg\`}>Dynamic</div>`
    const result = extractClassNames(source)

    // Should extract valid static class names from template literals
    t
      .expect([...result].sort())
      .toEqual(["text-lg"])
  })

  t.test("JSX with quoted strings", () => {
    const source = `<div className={"p-4 m-2"}>Static in braces</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["m-2", "p-4"])
  })

  t.test("Multi-line attributes", () => {
    const source = `<div 
      className="
        grid 
        grid-cols-3 
        gap-4
      "
    >Grid</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["gap-4", "grid", "grid-cols-3"])
  })

  t.test("Whitespace variations around equals", () => {
    const cases = [
      `<div class="text-sm">Normal</div>`,
      `<div class ="text-md">Space before</div>`,
      `<div class= "text-lg">Space after</div>`,
      `<div class = "text-xl">Spaces both</div>`,
    ]

    for (const source of cases) {
      const result = extractClassNames(source)

      t
      .expect(result.size)
        .toBe(1)
    }
  })

  t.test("Arbitrary value classes", () => {
    const source =
      `<div className="w-[32px] bg-[#ff0000] text-[1.5rem]">Arbitrary</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["bg-[#ff0000]", "text-[1.5rem]", "w-[32px]"])
  })

  t.test("Fraction classes", () => {
    const source = `<div className="w-1/2 h-3/4">Fractions</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["h-3/4", "w-1/2"])
  })

  t.test("Complex Tailwind classes", () => {
    const source =
      `<div className="sm:w-1/2 md:w-1/3 lg:w-1/4 hover:bg-gray-100 focus:ring-2">Responsive</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual([
        "focus:ring-2",
        "hover:bg-gray-100",
        "lg:w-1/4",
        "md:w-1/3",
        "sm:w-1/2",
      ])
  })

  t.test("Should ignore similar attribute names", () => {
    const source =
      `<div data-class="should-ignore" myclass="also-ignore" class="keep-this">Test</div>`
    const result = extractClassNames(source)

    t
      .expect([...result])
      .toEqual(["keep-this"])
  })

  t.test("Should handle case sensitivity", () => {
    const source =
      `<div Class="uppercase-class" class="lowercase-class">Mixed case</div>`
    const result = extractClassNames(source)

    // Our current implementation only matches lowercase 'class'
    t
      .expect([...result])
      .toEqual(["lowercase-class"])
  })

  t.test("Empty class attributes", () => {
    const source = `<div class="" className=''>Empty</div>`
    const result = extractClassNames(source)

    t
      .expect(result.size)
      .toBe(0)
  })

  t.test("Classes with special characters", () => {
    const source =
      `<div className="group-hover:text-blue-500 peer-focus:ring-2">Special chars</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["group-hover:text-blue-500", "peer-focus:ring-2"])
  })

  t.test("Should not match classes in comments", () => {
    const source = `
      <!-- <div class="commented-out">Should not match</div> -->
      <div class="real-class">Should match</div>
    `
    const result = extractClassNames(source)

    t
      .expect([...result])
      .toEqual(["real-class"])
  })

  t.test("Should not match classes in strings", () => {
    const source = `
      const message = "This class='fake-class' should not match";
      <div class="real-class">Real element</div>
    `
    const result = extractClassNames(source)

    t
      .expect([...result])
      .toEqual(["real-class"])
  })

  t.test("Complex JSX expressions should be ignored", () => {
    const source = `
      <div className={condition ? "conditional-class" : "other-class"}>Conditional</div>
      <div className={\`template-\${variable}\`}>Template</div>
      <div className={getClasses()}>Function call</div>
      <div className="static-class">Static</div>
    `
    const result = extractClassNames(source)

    // Only the static class should match with our strict implementation
    t
      .expect([...result])
      .toEqual(["static-class"])
  })

  t.test("Vue.js class bindings should be ignored", () => {
    const source = `
      <div :class="{ 'active': isActive }">Vue object</div>
      <div :class="['base', condition && 'active']">Vue array</div>
      <div class="static-vue-class">Static Vue</div>
    `
    const result = extractClassNames(source)

    // Only static class should match
    t
      .expect([...result])
      .toEqual(["static-vue-class"])
  })

  t.test("Svelte class directives should be ignored", () => {
    const source = `
      <div class:active={condition}>Svelte directive</div>
      <div class="static-svelte-class">Static Svelte</div>
    `
    const result = extractClassNames(source)

    t
      .expect([...result])
      .toEqual(["static-svelte-class"])
  })

  t.test("Escaped quotes should be handled", () => {
    const source =
      `<div class="text-sm before:content-['Hello']">Escaped quotes</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["before:content-['Hello']", "text-sm"])
  })

  t.test("Current broad implementation comparison", () => {
    const source = `
      <div class="bg-red-500 text-white">Element</div>
      <p>Some random-text-with-hyphens in content</p>
      const variable = "some-string";
    `

    const broadResult = extractClassNamesBroad(source)
    const strictResult = extractClassNames(source)

    // Broad should pick up more tokens
    t
      .expect(broadResult.size)
      .toBeGreaterThan(strictResult.size)

    // Strict should only have the actual class names
    t
      .expect([...strictResult].sort())
      .toEqual(["bg-red-500", "text-white"])
  })

  t.test("Component names with dots", () => {
    const source =
      `<Toast.Toast class="toast toast-top toast-center fixed top-8 z-10">Content</Toast.Toast>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["fixed", "toast", "toast-center", "toast-top", "top-8", "z-10"])
  })

  t.test("Complex component names and attributes", () => {
    const source = `
      <My.Component.Name className="flex items-center">Content</My.Component.Name>
      <Component-with-dashes class="bg-red-500">Content</Component-with-dashes>
      <Component123 className="text-lg">Content</Component123>
      <namespace:element class="border-2">XML style</namespace:element>
    `
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual([
        "bg-red-500",
        "border-2",
        "flex",
        "items-center",
        "text-lg",
      ])
  })

  t.test("Conditional JSX with Toast component", () => {
    const source = `{toastParam !== undefined && (
          <Toast.Toast class="toast toast-top toast-center fixed top-8 z-10">
            <div class="alert alert-success">
              <span>
                {toastParam}
              </span>
            </div>
          </Toast.Toast>
        )}`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual([
        "alert",
        "alert-success",
        "fixed",
        "toast",
        "toast-center",
        "toast-top",
        "top-8",
        "z-10",
      ])
  })

  t.test("Template literals with expressions", () => {
    const source = `<div class={\`toast \${props.class ?? ""}\`}>Content</div>`
    const result = extractClassNames(source)

    t
      .expect([...result].sort())
      .toEqual(["toast"])
  })
})
