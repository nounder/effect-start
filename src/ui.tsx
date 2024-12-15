import { createAsync } from "@nounder/solid-router"
import { sharedConfig } from "solid-js"

export function Link(props: { url: string }) {
  return (
    <a href={props.url}>
      {props.url}
    </a>
  )
}

export function RandomComponent() {
  return (
    <div class="w-8">
      <h1 class="w-4">Headline</h1>
      yoo!{"&nbsp;"}
      <Link url="yo" />
    </div>
  )
}
