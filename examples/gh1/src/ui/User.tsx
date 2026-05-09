import { Route } from "effect-start"
import * as Github from "../Github.ts"

export function UserCard(props: {
  login: string
  avatar: string
  name?: string
  bio?: string
  type?: string
}) {
  const href = props.type === "Organization"
    ? Route.link("/orgs/:org", { org: props.login })
    : Route.link("/:owner", { owner: props.login })
  return (
    <a
      href={href}
      class="flex items-center gap-3 p-3 rounded-md hover:bg-[#161b22] transition-colors"
    >
      <img
        src={props.avatar}
        alt={props.login}
        class={`w-10 h-10 ${
          props.type === "Organization" ? "rounded-md" : "rounded-full"
        } bg-[#21262d]`}
      />
      <div class="min-w-0">
        <div class="text-[#58a6ff] text-sm font-medium truncate">
          {props.login}
        </div>
        {props.name && (
          <div class="text-[#8b949e] text-xs truncate">
            {props.name}
          </div>
        )}
      </div>
    </a>
  )
}

export function ContributorCard(
  props: { login: string; avatar: string; contributions: number },
) {
  return (
    <a
      href={Route.link("/:owner", { owner: props.login })}
      class="flex items-center gap-2 p-2 rounded hover:bg-[#161b22] transition-colors"
    >
      <img src={props.avatar} class="w-8 h-8 rounded-full bg-[#21262d]" />
      <div class="min-w-0">
        <div class="text-sm text-[#58a6ff] font-medium truncate">
          {props.login}
        </div>
        <div class="text-xs text-[#8b949e]">
          {Github.num(props.contributions)} commits
        </div>
      </div>
    </a>
  )
}
