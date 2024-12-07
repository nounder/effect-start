import { createAsync } from "@nounder/solid-router"

export function Link(props: { url: string }) {
  return (
    <a href={props.url}>
      somet
    </a>
  )
}

export function RandomComponent() {
  const res = createAsync(() =>
    fetch("http://example.com").then((v) => v.text())
  )

  return (
    <div class="w-8">
      <h1 class="w-4">Headline</h1>
      yoo!{"&nbsp;"}
      <a href="/yoo">{res()}</a>
      <Link url="haha" />
    </div>
  )
}
