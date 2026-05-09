import { Html, Route } from "effect-start"
import * as Github from "../Github.ts"

export function IssueRow(props: {
  number: number
  title: string
  state: string
  user: string
  comments: number
  created: string
  labels?: ReadonlyArray<{ readonly name: string; readonly color: string }>
  isPr?: boolean
  owner: string
  repo: string
}) {
  const isOpen = props.state === "open"
  const icon = props.isPr
    ? isOpen
      ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="#3fb950"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354Z" /></svg>`
      : `<svg width="16" height="16" viewBox="0 0 16 16" fill="#a371f7"><path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218Z" /></svg>`
    : isOpen
    ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="#3fb950"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" /></svg>`
    : `<svg width="16" height="16" viewBox="0 0 16 16" fill="#a371f7"><path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L8 7.94 5.78 5.72a.75.75 0 0 0-1.06 1.06L6.94 9l-2.22 2.22a.75.75 0 1 0 1.06 1.06L8 10.06l2.22 2.22a.75.75 0 1 0 1.06-1.06L9.06 9l2.22-2.22Z" /><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" /></svg>`
  return (
    <div class="flex items-start gap-2 py-2 px-3 hover:bg-[#161b22] rounded">
      <span class="mt-1 shrink-0">
        {Html.unsafe(icon)}
      </span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <a
            href={Route.link("/:owner/:repo/issues/:number", {
              owner: props.owner,
              repo: props.repo,
              number: props.number,
            })}
            class="text-sm font-semibold text-[#e6edf3] hover:text-[#58a6ff]"
          >
            {props.title}
          </a>
          {props.labels?.map((l: any) => (
            <span
              class="text-xs rounded-full px-2 py-0.5 font-medium border"
              style={`color: #${l.color}; border-color: #${l.color}40; background-color: #${l.color}18`}
            >
              {l.name}
            </span>
          ))}
        </div>
        <div class="text-xs text-[#8b949e] mt-0.5">
          #{props.number} opened {Github.timeAgo(props.created)} by {props.user}
        </div>
      </div>
      {props.comments > 0 && (
        <span class="flex items-center gap-1 text-xs text-[#8b949e] shrink-0 mt-1">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
          </svg>
          {props.comments}
        </span>
      )}
    </div>
  )
}

export function StateFilter(props: {
  current: string
  openHref: string
  closedHref: string
  counts?: { open?: number; closed?: number }
}) {
  return (
    <div class="flex gap-2 mb-4 text-sm">
      <a
        href={props.openHref}
        class={`flex items-center gap-1 ${
          props.current === "open"
            ? "text-[#e6edf3] font-semibold"
            : "text-[#8b949e] hover:text-[#e6edf3]"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="#3fb950">
          <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
        </svg>
        {props.counts?.open !== undefined
          ? `${Github.num(props.counts.open)} Open`
          : "Open"}
      </a>
      <a
        href={props.closedHref}
        class={`flex items-center gap-1 ${
          props.current === "closed"
            ? "text-[#e6edf3] font-semibold"
            : "text-[#8b949e] hover:text-[#e6edf3]"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="#a371f7">
          <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L8 7.94 5.78 5.72a.75.75 0 0 0-1.06 1.06L6.94 9l-2.22 2.22a.75.75 0 1 0 1.06 1.06L8 10.06l2.22 2.22a.75.75 0 1 0 1.06-1.06L9.06 9l2.22-2.22Z" />
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
        </svg>
        {props.counts?.closed !== undefined
          ? `${Github.num(props.counts.closed)} Closed`
          : "Closed"}
      </a>
    </div>
  )
}
