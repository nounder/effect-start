import { Route } from "effect-start"
import * as Github from "../Github.ts"

export function CommitRow(props: {
  sha: string
  message: string
  author: string
  avatar?: string
  date: string
  owner: string
  repo: string
}) {
  const shortSha = props.sha.slice(0, 7)
  const firstLine = props.message.split("\n")[0]
  return (
    <div class="flex items-center gap-3 rounded px-3 py-2 hover:bg-[#161b22]">
      {props.avatar && (
        <img
          src={props.avatar}
          class="h-5 w-5 shrink-0 rounded-full"
        />
      )}
      <div class="min-w-0 flex-1">
        <a
          href={Route.link("/:owner/:repo/commit/:sha", {
            owner: props.owner,
            repo: props.repo,
            sha: props.sha,
          })}
          class="block truncate text-sm font-medium text-[#e6edf3] hover:text-[#58a6ff]"
        >
          {firstLine}
        </a>
        <div class="text-xs text-[#8b949e]">
          <span class="font-medium text-[#e6edf3]">{props.author}</span> committed{" "}
          {Github.timeAgo(props.date)}
        </div>
      </div>
      <code class="shrink-0 cursor-pointer rounded bg-[#388bfd1a] px-2 py-0.5 font-mono text-xs text-[#58a6ff] transition-colors hover:bg-[#58a6ff] hover:text-white">
        {shortSha}
      </code>
    </div>
  )
}
