import { Route } from "effect-start"
import * as Github from "../Github.ts"

export function UserCard(props: {
  login: string
  avatar: string
  name?: string
  bio?: string
  type?: string
}) {
  const href =
    props.type === "Organization"
      ? Route.link("/orgs/:org", { org: props.login })
      : Route.link("/:owner", { owner: props.login })
  return (
    <a
      href={href}
      class="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-[#161b22]"
    >
      <img
        src={props.avatar}
        alt={props.login}
        class={`h-10 w-10 ${props.type === "Organization" ? "rounded-md" : "rounded-full"} bg-[#21262d]`}
      />
      <div class="min-w-0">
        <div class="truncate text-sm font-medium text-[#58a6ff]">{props.login}</div>
        {props.name && <div class="truncate text-xs text-[#8b949e]">{props.name}</div>}
      </div>
    </a>
  )
}

export function ContributorCard(props: { login: string; avatar: string; contributions: number }) {
  return (
    <a
      href={Route.link("/:owner", { owner: props.login })}
      class="flex items-center gap-2 rounded p-2 transition-colors hover:bg-[#161b22]"
    >
      <img
        src={props.avatar}
        class="h-8 w-8 rounded-full bg-[#21262d]"
      />
      <div class="min-w-0">
        <div class="truncate text-sm font-medium text-[#58a6ff]">{props.login}</div>
        <div class="text-xs text-[#8b949e]">{Github.num(props.contributions)} commits</div>
      </div>
    </a>
  )
}
