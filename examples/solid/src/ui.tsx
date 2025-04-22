import { A } from "@solidjs/router"

export function RandomComponent() {
  return (
    <div>
      <h1 class="w-4">Random</h1>
      {Math.random()}

      <a href="/">
        Home (plain)
      </a>

      <br />

      <A href="/">
        Home (router)
      </A>
    </div>
  )
}
