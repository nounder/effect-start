import {
  StrictMode,
} from "react"
import {
  hydrateRoot,
} from "react-dom/client"

hydrateRoot(
  document.getElementById("root") as HTMLElement,
  <StrictMode>
    <div>
      Hello
    </div>
  </StrictMode>,
)
