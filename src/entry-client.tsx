import { hydrate } from "solid-js/web"
import { Route, Router } from "@nounder/solid-router"
import routes from "./routes.ts"
import App from "./App.tsx"

// TODO: why do we need render a component before passing it to hydrate
// for it to work?
// docs says it should be () => JSX.Element
// see: https://docs.solidjs.com/reference/rendering/hydrate

export default function Root() {
  return (
    <Router
      url={props.url}
    >
      {routes.map(([path, component]) => (
        <Route path={path} component={component} />
      ))}
    </Router>
  )
}

hydrate(<Root />, document.body)
