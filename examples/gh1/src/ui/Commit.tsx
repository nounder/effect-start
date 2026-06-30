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
    <div class="flex items-center gap-3 py-2 px-3 hover:bg-[#161b22] rounded">
      {props.avatar && <img src={props.avatar} class="w-5 h-5 rounded-full shrink-0" />}
      <div class="flex-1 min-w-0">
        <a
          href={Route.link("/:owner/:repo/commit/:sha", {
            owner: props.owner,
            repo: props.repo,
            sha: props.sha,
          })}
          class="text-sm text-[#e6edf3] font-medium hover:text-[#58a6ff] truncate block"
        >
          {firstLine}
        </a>
        <div class="text-xs text-[#8b949e]">
          <span class="font-medium text-[#e6edf3]">
            {props.author}
          </span>{" "}
          committed {Github.timeAgo(props.date)}
        </div>
      </div>
      <code class="text-xs text-[#58a6ff] bg-[#388bfd1a] px-2 py-0.5 rounded shrink-0 font-mono hover:bg-[#58a6ff] hover:text-white transition-colors cursor-pointer">
        {shortSha}
      </code>
    </div>
  )
}
