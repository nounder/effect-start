import { useEffect, useState } from "react"

export function App() {
  const [message, setMessage] = useState("Hello, Effect Bundler!!!!!")
  const [count, setCount] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((count) => count + 1)
    }, 100)

    return () => clearInterval(interval)
  })

  return <div>Hello, Effect Bundler {count}.</div>
}
