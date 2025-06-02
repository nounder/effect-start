import {
  lazy,
  Route,
} from "preact-iso"
import { Pages } from "./routes/pages.gen.ts"

export const Routes = Pages.map(page => {
  const path = page.path.split("/").reduce(
    (acc, seg) =>
      seg.startsWith("$")
        ? seg.length === 1
          ? `${acc}/*`
          : `${acc}/:${seg.slice(1)}`
        : `${acc}/${seg}`,
    "",
  )

  const Layout = page.layout
    ? lazy(page.layout.load)
    : null
  const Component = Layout
    ? () => (
      <Layout>
        {lazy(page.load)}
      </Layout>
    )
    : lazy(page.load)

  return {
    path,
    component: Component,
  }
})

export const RouteComponents = Routes.map(route => {
  return (
    <Route
      path={route.path}
      component={route.component}
    />
  )
})
