export function Link(props: { url: string }) {
  return (
    <a href={props.url}>
      somet
    </a>
  )
}

export function RandomComponent(props: {
  enabled?: boolean
}) {
  return (
    <div class="w-8" classList={{ enabled: props.enabled }}>
      <h1 class="w-4">Headline</h1>
      yoo!{"&nbsp;"}
      <a href="/yoo">koko</a>
      <Link url="haha" />
    </div>
  )
}

<RandomComponent />
