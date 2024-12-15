import { JSX } from "solid-deno/jsx-runtime"
import { RandomComponent } from "./ui.tsx"

export default [
  ["/", RandomComponent],
  ["/random", RandomComponent],
] as [string, () => JSX.Element][]
