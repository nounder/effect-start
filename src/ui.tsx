import { createAsync } from "@nounder/solid-router"
import { sharedConfig } from "solid-js"
import { A } from "@nounder/solid-router"

export function RandomComponent() {
  return (
    <div class="w-8">
      <h1 class="w-4">Random</h1>
      {Math.random()}
      {"&nbsp;"}

      <a href="/">
        Home (plain)
      </a>

      {"&nbsp;"}

      <A href="/">
        Home (router)
      </A>

      {"&nbsp;"}
    </div>
  )
}
