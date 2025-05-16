import { createRoot } from "react-dom/client"

function App() {
  return <div>Hello, Effect Bundler.</div>
}

{
  const root = createRoot(document.getElementById("app")!)
  root.render(<App />)
}
