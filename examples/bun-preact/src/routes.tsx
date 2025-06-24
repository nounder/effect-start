import {
  lazy,
  Route,
  useRoute,
} from "preact-iso"
import { Pages } from "./routes/_manifest.ts"

function collectLayouts(page: (typeof Pages)[number]) {
  const layouts: NonNullable<(typeof Pages)[number]["parent"]>[] = []
  let currentLayout: any = page.parent

  while (currentLayout) {
    layouts.unshift(currentLayout)
    currentLayout = currentLayout.parent
  }

  return layouts
}

export const Routes = Pages.map(page => {
  const path = page.path.split("/").slice(1).reduce(
    (acc, seg) =>
      seg.startsWith("$")
        ? seg === "$"
          ? `${acc}/:**`
          : `${acc}/:${seg.slice(1)}`
        : `${acc}/${seg}`,
    "",
  )

  const layouts = collectLayouts(page)
  const Page = lazy(page.load)

  const Component = layouts.length > 0
    ? layouts.reduceRight(
      (content, layout) => {
        const Layout = lazy(layout.load)

        return () => {
          const route = useRoute()
          const props = {
            params: route.params,
            query: route.query,
            path: route.path,
          }

          return (
            <Layout
              {...props}
            >
              {content(props)}
            </Layout>
          )
        }
      },
      (props: any) => <Page {...props} />,
    )
    : (props: any) => <Page {...props} />

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
