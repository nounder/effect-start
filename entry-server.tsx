import { Route, Router, useLocation } from "@nounder/solid-router"

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function Home() {
  return <div>home</div>
}

function Any() {
  const loc = useLocation()

  return <div>pathname: {loc.pathname}</div>
}

export default function (args: { url: string }) {
  return (
    <Router url={args.url}>
      <Route path="/" component={Home} />
      <Route path="*" component={Any} />
    </Router>
  )
}
