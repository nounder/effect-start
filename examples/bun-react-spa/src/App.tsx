import "effect-start/client"

import {
  useEffect,
  useState,
} from "react"

export function App() {
  const [message, setMessage] = useState("Hello, Effect Start!!!!!")
  const [count, setCount] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((count) => count + 100)
    }, 100)

    return () => clearInterval(interval)
  })

  return (
    <div>
      Hello, Effect Start {count}.
    </div>
  )
}
