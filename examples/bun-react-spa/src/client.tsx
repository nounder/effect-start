import {
  createRoot,
} from "react-dom/client"
import {
  App,
} from "./App.tsx"

const root = createRoot(document.getElementById("app")!)
root.render(<App />)
