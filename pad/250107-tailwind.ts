/**
 * Programatically generate tailwind css.
 */
import * as tw from "@tailwindcss/node"
import * as fs from "jsr:@std/fs"

const files = await Array.fromAsync(fs.expandGlob("src/**/*.tsx"))

const canidates = files.map((v) => v.path)

const res = await tw.compile(
  `
  @import "tailwindcss";
`,
  {
    base: Deno.cwd(),
    onDependency(path) {
      console.log(`Dependency ${path}`)
    },
  },
)

const css = res.build(canidates)

console.log("CSS:", css.slice(0, 100), css.length)
