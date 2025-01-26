import { Route, Router } from "@solidjs/router"
import { render } from "solid-js/web"
import Home from "./Home.tsx"
import routes from "./routes.ts"

// TODO: why do we need render a component before passing it to hydrate
// for it to work?
// docs says it should be () => JSX.Element
// see: https://docs.solidjs.com/reference/rendering/hydrate

export default function Root() {
  return (
    <Router>
      {routes.map(([path, component]) => (
        <Route path={path} component={component} />
      ))}
    </Router>
  )
}

const ssrChildren = Array.from(document.body.children)

render(<Root />, document.body)

ssrChildren.forEach((child) => {
  child.remove()
})
