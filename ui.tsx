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
    <div class="root" classList={{ enabled: props.enabled }}>
      <h1>Headline</h1>
      <span>Yoo</span>
      <a href="/yoo">koko</a>
      <Link url="haha" />
    </div>
  )
}

<RandomComponent />
