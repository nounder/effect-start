import { Route, StaticRouter, useCurrentMatches } from "@nounder/solid-router"
import { RandomComponent } from "./ui.tsx"

function ServerWrapper(props) {
  // todo: this should be empty if there are no matches.
  // depending on that return 404?
  const m = useCurrentMatches()

  return props.children
}

export default function (args: { url: string }) {
  return (
    <StaticRouter
      url={args.url}
      ref={(e) => console.log(e)}
      root={ServerWrapper}
    >
      <Route path="/" component={ServerWrapper} />
      <Route path="/random" component={RandomComponent} />
    </StaticRouter>
  )
}
