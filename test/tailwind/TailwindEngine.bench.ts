import { heapStats } from "bun:jsc"
import * as NPath from "node:path"
import { TailwindEngine } from "effect-start/tailwind"
import * as TailwindPlugin from "effect-start/tailwind/TailwindPlugin"
import * as TailwindCss from "tailwindcss"

const root = NPath.resolve(import.meta.dir, "../..")
const tailwindDir = NPath.dirname(Bun.resolveSync("tailwindcss/package.json", root))
const stylesheets = new Map<string, string>()
for (const file of ["index.css", "theme.css", "preflight.css", "utilities.css"]) {
  stylesheets.set(file, await Bun.file(NPath.join(tailwindDir, file)).text())
}

const css = `@import "tailwindcss";`

const tailwindCompile = () =>
  TailwindCss.compile(css, {
    base: root,
    loadStylesheet: async (id: string, base: string) => {
      const file = id === "tailwindcss" ? "index.css" : `${id.replace("tailwindcss/", "")}.css`
      return { path: file, base, content: stylesheets.get(file)! }
    },
  })

const chatCandidates = new Set<string>()
for await (const file of new Bun.Glob("examples/chat/src/**/*.{ts,tsx}").scan({
  cwd: root,
  absolute: true,
})) {
  for (const c of TailwindPlugin.extractClassNames(await Bun.file(file).text()))
    chatCandidates.add(c)
}

const designSystem = await TailwindCss.__unstable__loadDesignSystem(css, {
  base: root,
  loadStylesheet: async (id: string, base: string) => ({
    path: id,
    base,
    content: stylesheets.get(id === "tailwindcss" ? "index.css" : id.replace("tailwindcss/", ""))!,
  }),
} as Parameters<typeof TailwindCss.__unstable__loadDesignSystem>[1])
const classList = designSystem.getClassList().map(([name]) => name)
const variants = [
  "hover",
  "focus",
  "md",
  "lg",
  "dark",
  "group-hover",
  "data-[state=open]",
  "has-checked",
  "not-first",
]

let seed = 1
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const sample = (n: number) =>
  Array.from({ length: n }, () => classList[Math.floor(random() * classList.length)])
const withVariants = (list: Array<string>) =>
  list.map((c, i) => (i % 3 === 0 ? `${variants[i % variants.length]}:${c}` : c))
const typical = withVariants(sample(1500))
const junk = Array.from({ length: 5000 }, (_, i) => `word${i}`)

const corpora: Array<[string, Array<string>]> = [
  [`examples/chat (${chatCandidates.size} tokens)`, [...chatCandidates]],
  [`app-sized (1500 utilities + 5000 non-utility tokens)`, [...typical, ...junk]],
  [`full class list (${classList.length} utilities)`, classList],
]

function median(times: Array<number>): number {
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]
}

async function measure(
  fn: () => unknown | Promise<unknown>,
  minTime = 1000,
  minRuns = 5,
): Promise<number> {
  for (let i = 0; i < 3; i++) await fn()
  const times: Array<number> = []
  const start = performance.now()
  while (times.length < minRuns || performance.now() - start < minTime) {
    const t = performance.now()
    await fn()
    times.push(performance.now() - t)
    if (times.length >= 500) break
  }
  return median(times)
}

const normalize = (css: string) =>
  css
    .replace(/^\/\*! tailwindcss [^\n]+\n/, "")
    .replace(/\s+/g, " ")
    .trim()

async function measureEdit(candidates: Array<string>): Promise<[number, number]> {
  const edited = [...candidates, "w-[98765px]"]
  const upstream: Array<number> = []
  const vendored: Array<number> = []
  for (let trial = 0; trial < 11; trial++) {
    const tw = await tailwindCompile()
    const ours = TailwindEngine.make()
    const baseline = tw.build(candidates)
    if (normalize(baseline) !== normalize(ours.generate(candidates)))
      throw new Error("baseline CSS differs")

    const start = performance.now()
    const expected = tw.build(edited)
    const middle = performance.now()
    const actual = ours.generate(edited)
    const end = performance.now()

    if (baseline === expected || normalize(expected) !== normalize(actual))
      throw new Error("edited CSS differs")
    if (trial >= 2) {
      upstream.push(middle - start)
      vendored.push(end - middle)
    }
  }
  return [median(upstream), median(vendored)]
}

const format = (ms: number) => (ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : `${ms.toFixed(2)} ms`)

async function importTime(specifier: string): Promise<number> {
  const runs: Array<number> = []
  const script = `const t = performance.now(); await import(${JSON.stringify(
    specifier,
  )}); console.log(performance.now() - t)`
  for (let attempt = 0; runs.length < 7 && attempt < 20; attempt++) {
    const proc = Bun.spawn(["bun", "-e", script], { cwd: root, stdout: "pipe", stderr: "ignore" })
    const ms = Number((await new Response(proc.stdout).text()).trim())
    if ((await proc.exited) === 0 && ms > 0) runs.push(ms)
  }
  return median(runs)
}

const rows: Array<[string, string, string, string, string]> = []
const row = (name: string, a: number, b: number) => {
  rows.push([name, format(a), format(b), `${(a / b).toFixed(1)}x`, ""])
}

row(
  "module import (cold process)",
  await importTime("tailwindcss"),
  await importTime(NPath.join(root, "src/tailwind/TailwindEngine.ts")),
)
row(
  "setup (compile / make)",
  await measure(tailwindCompile),
  await measure(() => TailwindEngine.make()),
)

for (const [name, candidates] of corpora) {
  const tw = await tailwindCompile()
  const ours = TailwindEngine.make()
  if (tw.build(candidates).length === 0 || ours.generate(candidates).length === 0)
    throw new Error("empty output")

  row(
    `${name}: setup + generate (cold)`,
    await measure(async () => (await tailwindCompile()).build(candidates)),
    await measure(() => TailwindEngine.make().generate(candidates)),
  )
  row(
    `${name}: rebuild, same candidates`,
    await measure(() => tw.build(candidates)),
    await measure(() => ours.generate(candidates)),
  )
  row(`${name}: rebuild, one new candidate`, ...(await measureEdit(candidates)))
}

const log = (text: string) => process.stdout.write(`${text}\n`)

const header: [string, string, string, string, string] = [
  "benchmark",
  "tailwindcss",
  "TailwindEngine",
  "speedup",
  "",
]
const widths = header.map((_, i) => Math.max(...[header, ...rows].map((r) => r[i].length)))
const line = (r: Array<string>) =>
  r
    .slice(0, 4)
    .map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i])))
    .join("  ")
log(
  `tailwindcss ${(await Bun.file(NPath.join(tailwindDir, "package.json")).json()).version}, Bun ${Bun.version}\n`,
)
log(line(header))
for (const r of rows) log(line(r))

const watchEngine = TailwindEngine.make()
const baseline = watchEngine.generate(chatCandidates)
const times: Array<number> = []
Bun.gc(true)
const initialHeap = heapStats().heapSize
for (let edit = 0; edit < 200; edit++) {
  const tokens = [...chatCandidates, `min-[${edit}px]:w-[${edit}px]`]
  for (let i = 0; i < 256; i++) tokens.push(`unknown-${edit}-${i}:word`)
  const start = performance.now()
  watchEngine.generate(tokens)
  times.push(performance.now() - start)
}
watchEngine.generate(chatCandidates)
Bun.gc(true)
const retained = heapStats().heapSize - initialHeap
log(
  `Watch mode (200 replacements of one rule and 256 rejected tokens): ${format(median(times))} median, ` +
    `${(retained / 1024 / 1024).toFixed(2)} MiB heap change`,
)
if (watchEngine.generate(chatCandidates) !== baseline)
  throw new Error("removed rules survived watch edits")
