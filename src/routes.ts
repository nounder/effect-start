import { JSX } from "solid-deno/jsx-runtime"
import { RandomComponent } from "./ui.tsx"
import Home from "./Home.tsx"

export default [
  ["/", Home],
  ["/random", RandomComponent],
] as [string, () => JSX.Element][]
