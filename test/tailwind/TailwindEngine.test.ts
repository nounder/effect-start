import * as test from "bun:test"
import * as NPath from "node:path"
import { TailwindEngine } from "effect-start/tailwind"
import * as TailwindCss from "tailwindcss"

const tailwindDir = NPath.dirname(Bun.resolveSync("tailwindcss/package.json", import.meta.dir))

const tailwind = async (css: string, candidates: Array<string>) => {
  const compiler = await TailwindCss.compile(css, {
    base: import.meta.dir,
    loadStylesheet: async (id: string, base: string) => {
      const file = id === "tailwindcss" ? "index.css" : `${id.replace("tailwindcss/", "")}.css`
      return { path: file, base, content: await Bun.file(NPath.join(tailwindDir, file)).text() }
    },
  })
  return compiler.build(candidates)
}

const normalize = (css: string) =>
  css
    .replace(/^\/\*! tailwindcss .*\*\/\n/, "")
    .replace(/\s+/g, " ")
    .trim()

const candidates = [
  "flex",
  "hidden",
  "sm:grid",
  "md:hover:bg-red-500/50",
  "p-4",
  "px-2.5",
  "-mt-4",
  "w-1/2",
  "w-[calc(100%-2rem)]",
  "max-w-screen-md",
  "size-10",
  "inset-x-0",
  "translate-x-1/2",
  "rotate-45",
  "scale-110",
  "text-sm",
  "text-sm/6",
  "font-semibold",
  "tracking-tight",
  "leading-relaxed",
  "text-gray-900",
  "text-(--brand)",
  "bg-[#ff0000]",
  "bg-[url(/a_b.png)]",
  "bg-linear-to-r",
  "from-sky-500",
  "via-30%",
  "to-indigo-500",
  "border",
  "border-t-2",
  "border-red-500/20",
  "divide-y",
  "space-x-4",
  "rounded-lg",
  "rounded-t-none",
  "shadow-lg",
  "shadow-black/30",
  "ring-2",
  "ring-blue-500/40",
  "ring-offset-2",
  "outline-hidden",
  "drop-shadow-md",
  "blur-sm",
  "backdrop-blur",
  "opacity-50",
  "transition",
  "duration-300",
  "ease-in-out",
  "animate-spin",
  "mask-x-from-10%",
  "mask-radial-from-50%",
  "[color:red]",
  "[--gap:10px]",
  "!flex",
  "underline!",
  "group-hover:underline",
  "group-hover/item:underline",
  "peer-checked:bg-blue-500",
  "has-[>img]:p-0",
  "not-hover:opacity-75",
  "in-focus:opacity-100",
  "data-[state=open]:block",
  "aria-expanded:rotate-180",
  "supports-[display:grid]:grid",
  "max-lg:hidden",
  "min-[600px]:flex",
  "@container",
  "@md:flex",
  "@max-lg/main:hidden",
  "[&>svg]:size-4",
  "[@media(hover:none)]:opacity-100",
  "*:p-2",
  "before:content-['x']",
  "after:absolute",
  "first:pt-0",
  "dark:bg-black",
  "motion-safe:animate-pulse",
  "print:hidden",
  "not-a-utility",
  "hover:not-a-utility",
]

test.describe("make", () => {
  test.it("matches tailwindcss output", async () => {
    const expected = await tailwind(`@import "tailwindcss";`, candidates)
    const actual = TailwindEngine.make().generate(candidates)

    test.expect(normalize(actual)).toBe(normalize(expected))
  })

  test.it("matches tailwindcss output for an equivalent @theme and @custom-variant", async () => {
    const css = `
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
@theme {
  --color-*: initial;
  --color-brand: oklch(60% 0.2 30);
  --animate-wiggle: wiggle 1s ease-in-out infinite;
  @keyframes wiggle {
    50% {
      rotate: 3deg;
    }
  }
}
`
    const used = [
      "bg-brand/50",
      "text-red-500",
      "dark:text-brand",
      "animate-wiggle",
      "border-brand/25",
    ]
    const expected = await tailwind(css, used)
    const actual = TailwindEngine.make({
      variables: {
        "--color-*": "initial",
        "--color-brand": "oklch(60% 0.2 30)",
        "--animate-wiggle": "wiggle 1s ease-in-out infinite",
      },
      keyframes: { wiggle: "50% { rotate: 3deg; }" },
      variants: { dark: "&:where(.dark, .dark *)" },
    }).generate(used)

    test.expect(normalize(actual)).toBe(normalize(expected))
  })

  test.it("includes transitive theme dependencies of active keyframes", () => {
    const generator = TailwindEngine.make({
      preflight: false,
      variables: {
        "--animate-wiggle": "wiggle 1s",
        "--animate-unused": "unused 1s",
        "--color-brand": "var(--color-accent)",
        "--color-accent": "red",
        "--color-unused": "blue",
      },
      keyframes: {
        wiggle: "to { color: var(\n  --color-brand); }",
        unused: "to { color: var(--color-unused); }",
      },
    })
    const active = generator.generate(["animate-wiggle"])
    test.expect(active).toContain("@keyframes wiggle")
    test.expect(active).toContain("--color-brand: var(--color-accent);")
    test.expect(active).toContain("--color-accent: red;")
    test.expect(active).not.toContain("--color-unused")
    test.expect(active).not.toContain("@keyframes unused")
    const removed = generator.generate([])
    test.expect(removed).not.toContain("--color-brand")
    test.expect(removed).not.toContain("@keyframes wiggle")
  })

  test.it("matches tailwindcss output for color, width and shadow values", async () => {
    const roots = [
      "border",
      "border-x",
      "border-t",
      "outline",
      "ring",
      "inset-ring",
      "ring-offset",
      "decoration",
      "stroke",
      "shadow",
      "inset-shadow",
      "text-shadow",
      "drop-shadow",
    ]
    const values = `
      /50 -none -none/50 -inherit -inherit/50 -initial -current -current/50 -transparent -red-500 -red-500/50
      -red-500/[0.3] -red-500/(--a) -0 -2 -2/50 -8 -[3px] -[3px]/50 -[length:3px] -[line-width:3px] -[#f00]
      -[#f00]/50 -[color:var(--x)] -[var(--x)] -(--x) -(length:--x) -(color:--x) -sm -sm/50 -lg/[30%] -2xs -md
      -[0_1px_2px_#000] -[0_1px_2px_#000]/50 -[0_1px_2px_var(--c)]/40 -[2] -[10%] -[thin] -[number:2]
    `
      .trim()
      .split(/\s+/)
    const used = roots.flatMap((root) => [root, ...values.map((value) => root + value)])
    const expected = await tailwind(`@import "tailwindcss";`, used)
    const actual = TailwindEngine.make().generate(used)

    test.expect(normalize(actual)).toBe(normalize(expected))
  })

  test.it("rejects variables without a leading --", () => {
    test
      .expect(() => TailwindEngine.make({ variables: { color: "red" } }))
      .toThrow("must start with")
  })

  test.it("omits preflight", () => {
    const css = TailwindEngine.make({ preflight: false }).generate(["flex"])

    test
      .expect(css)
      .toBe(
        "@layer theme, base, components, utilities;\n@layer utilities {\n  .flex {\n    display: flex;\n  }\n}\n",
      )
  })

  test.it("emits only theme variables in use", () => {
    const css = TailwindEngine.make({ preflight: false }).generate(["p-4", "text-red-500"])

    test.expect(css).toContain("--spacing: 0.25rem;")
    test.expect(css).toContain("--color-red-500:")
    test.expect(css).not.toContain("--color-blue-500")
  })

  test.it("tracks edits to mutable inputs and consumes single-use iterators once", () => {
    const generator = TailwindEngine.make({ preflight: false })
    const tokens = ["min-[700px]:flex", "hover:block", "unknown"]
    for (const edit of ["min-[600px]:grid", "hover:block", "min-[700px]:flex"]) {
      tokens[0] = edit
      const expected = TailwindEngine.make({ preflight: false }).generate(tokens)
      test.expect(generator.generate(tokens)).toBe(expected)
      test.expect(generator.generate(tokens.values())).toBe(expected)
    }
  })

  test.it("returns the same stylesheet for the same candidates", () => {
    const generator = TailwindEngine.make()
    const first = generator.generate(["flex", "p-4"])

    test.expect(generator.generate(["p-4", "flex", "flex"])).toBe(first)
    test.expect(generator.generate(["flex"])).not.toBe(first)
  })
})
