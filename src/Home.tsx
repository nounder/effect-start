import { createSignal } from "solid-js"
import { A } from "@solidjs/router"

export default function Home() {
  const [count, setCount] = createSignal(15)

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
