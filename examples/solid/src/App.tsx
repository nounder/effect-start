import { A, Router } from "@solidjs/router"
import { createSignal, onMount } from "solid-js"

const Routes = [
  {
    path: "/",
    component: Home,
  },
  {
    path: "/random",
    component: Random,
  },
  {
    path: "*404",
    component: () => {
      return <div innerHTML={`<!--ssr-not-found-->`}></div>
    },
  },
]

export function App(props?: {
  serverUrl?: string
}) {
  return (
    <Router url={props?.serverUrl}>
      {Routes}
    </Router>
  )
}

function Random() {
  return (
    <div>
      <h1 class="w-4">Random</h1>
      <div>n = {Math.random()}</div>

      <br />

      <A href="/">
        Home (router)
      </A>
    </div>
  )
}

function Home() {
  const [count, setCount] = createSignal(12)

  return (
    <div>
      <h1 class="bg-gray-400">
        Welcome, {count()}{" "}
        <button onClick={() => setCount(count() + 1)}>+</button>
      </h1>

      <br />

      <A href="/random">Random</A>

      <style>
        {`
body {
  background: black;
  color: white;
}
`}
      </style>
    </div>
  )
}
