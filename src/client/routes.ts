import type { JSX } from "solid-js/jsx-runtime"
import Home from "../Home.tsx"
import { RandomComponent } from "../ui.tsx"

export default [
  ["/", Home],
  ["/random", RandomComponent],
] as [string, () => JSX.Element][]
