import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"

const el = document.getElementById("app")!
const root = globalThis["_root"] ??= createRoot(el)

root.render(<App />)
