import "effect-start/client"
import {
  ErrorBoundary,
  LocationProvider,
  Router,
} from "preact-iso"
import { RouteComponents } from "./routes.tsx"

export function App() {
  return (
    <LocationProvider>
      <ErrorBoundary>
        <Router>
          {RouteComponents}
        </Router>
      </ErrorBoundary>
    </LocationProvider>
  )
}
