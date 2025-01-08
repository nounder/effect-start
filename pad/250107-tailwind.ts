/**
 * Programatically generate tailwind css.
 */
import * as tw from "@tailwindcss/node"
import * as fs from "jsr:@std/fs"

const files = await Array.fromAsync(fs.expandGlob("src/**/*.tsx"))

const canidates = files.map((v) => v.path)

const res = await tw.compile(
  [`@import "tailwindcss";`].join("\n"),
  {
    base: Deno.cwd(),
    onDependency(path) {
      console.log(`Dependency ${path}`)
    },
  },
)

// We can resue this function to do incremental builds, like here:
// https://github.com/tailwindlabs/tailwindcss/blob/d6c4e7235114f01edd8c719f2465d974068f236e/packages/%40tailwindcss-cli/src/commands/build/index.ts#L262
const css = res.build(canidates)

console.log("CSS:", css.slice(0, 100), css.length)
