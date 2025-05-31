import "effect-bundler/client"

import {
  useEffect,
  useState,
} from "preact/hooks"
import { signal } from "@preact/signals"

const state = signal(0)

export function App() {
  const [message, setMessage] = useState("Hello, Effect Bundler!!!!!")
  const [count, setCount] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((count) => count + 1000)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  
  console.log("render", {
    count,
    state: state.value,
  })

  return (
    <div onClick={() => {
      throw new Error("test")
    }}>
      Hello, Effect Bundler 
      <p>state: {state.value}.</p>
      <p>count: {count}.</p>
    </div>
  )
}
