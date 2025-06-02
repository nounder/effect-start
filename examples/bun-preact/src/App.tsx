import "effect-bundler/client"
import {
  LocationProvider,
  Router,
} from "preact-iso"
import { RouteComponents } from "./routes.tsx"

export function App() {
  return (
    <LocationProvider>
      <Router>
        {RouteComponents}
      </Router>
    </LocationProvider>
  )
}
