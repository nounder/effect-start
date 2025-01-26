import { Route, Router } from "@solidjs/router"
import { hydrate, render } from "solid-js/web"
import Home from "./Home.tsx"
import routes from "./routes.ts"

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

render(Root, document.body)

ssrChildren.forEach((child) => {
  child.remove()
})
