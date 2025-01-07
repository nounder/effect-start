import { createSignal } from "solid-js"

export default function App(props) {
  const [count, setCount] = createSignal(15)

  return (
    <div>
      <h1>Hello {Math.random()}, count is {count()}</h1>
      <button onClick={() => setCount(count() + 1)}>Yoo</button>
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
