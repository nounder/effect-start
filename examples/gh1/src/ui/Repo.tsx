import { Route } from "effect-start"
import * as Github from "../Github.ts"

export function RepoCard(props: {
  owner: string
  name: string
  description?: string | null
  language?: string | null
  stars: number
  forks: number
  updated?: string | null
  topics?: ReadonlyArray<string>
}) {
  const r = { owner: props.owner, repo: props.name }
  return (
    <div class="border border-[#21262d] rounded-md p-4 hover:border-[#30363d] transition-colors">
      <div class="flex items-start justify-between gap-2 mb-1">
        <h3 class="text-[#58a6ff] font-semibold text-sm truncate">
          <a href={Route.link("/:owner/:repo", r)} class="hover:underline">
            {props.owner}/{props.name}
          </a>
        </h3>
        <span class="text-[#8b949e] border border-[#30363d] rounded-full text-xs px-2 py-0.5 shrink-0">
          Public
        </span>
      </div>
      {props.description && (
        <p class="text-[#8b949e] text-xs mb-3 line-clamp-2">
          {props.description}
        </p>
      )}
      {props.topics && props.topics.length > 0 && (
        <div class="flex flex-wrap gap-1 mb-3">
          {props.topics.slice(0, 5).map((t: string) => (
            <a
              href={`/search?q=topic:${t}`}
              class="text-[#58a6ff] bg-[#388bfd1a] rounded-full text-xs px-2.5 py-0.5 hover:bg-[#58a6ff] hover:text-white transition-colors"
            >
              {t}
            </a>
          ))}
        </div>
      )}
      <div class="flex items-center gap-4 text-xs text-[#8b949e]">
        {props.language && (
          <span class="flex items-center gap-1">
            <span
              class="w-3 h-3 rounded-full inline-block"
              style={`background-color: ${Github.langColor(props.language)}`}
            />
            {props
              .language}
          </span>
        )}
        {props.stars > 0 && (
          <a
            href={Route.link("/:owner/:repo", r)}
            class="flex items-center gap-1 hover:text-[#58a6ff]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
            </svg>
            {Github.num(props.stars)}
          </a>
        )}
        {props.forks > 0 && (
          <a
            href={Route.link("/:owner/:repo", r)}
            class="flex items-center gap-1 hover:text-[#58a6ff]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 0-1.5 0v.878H6.75v-.878a2.25 2.25 0 1 0-1.5 0ZM8 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
            </svg>
            {Github.num(props.forks)}
          </a>
        )}
        {props.updated && (
          <span>
            Updated {Github.timeAgo(props.updated)}
          </span>
        )}
      </div>
    </div>
  )
}

export function RepoListItem(props: {
  owner: string
  repo: string
  description?: string | null
  language?: string | null
  stars: number
  forks: number
  updated?: string | null
  topics?: ReadonlyArray<string>
}) {
  const r = { owner: props.owner, repo: props.repo }
  return (
    <div class="py-6 border-b border-[#21262d]">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-xl mb-1">
            <a
              href={Route.link("/:owner/:repo", r)}
              class="text-[#58a6ff] font-semibold hover:underline"
            >
              {props.owner}/{props.repo}
            </a>
          </h3>
          {props.description && (
            <p class="text-[#8b949e] text-sm mb-2 max-w-[680px]">
              {props.description}
            </p>
          )}
          {props.topics && props.topics.length > 0 && (
            <div class="flex flex-wrap gap-1 mb-2">
              {props.topics.slice(0, 6).map((t: string) => (
                <a
                  href={`/search?q=topic:${t}`}
                  class="text-[#58a6ff] bg-[#388bfd1a] rounded-full text-xs px-2.5 py-0.5 hover:bg-[#58a6ff] hover:text-white transition-colors"
                >
                  {t}
                </a>
              ))}
            </div>
          )}
          <div class="flex items-center gap-4 text-xs text-[#8b949e]">
            {props.language && (
              <span class="flex items-center gap-1">
                <span
                  class="w-3 h-3 rounded-full inline-block"
                  style={`background-color: ${
                    Github.langColor(props.language)
                  }`}
                />
                {props.language}
              </span>
            )}
            {props.stars > 0 && (
              <span class="flex items-center gap-1">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                </svg>
                {Github.num(props.stars)}
              </span>
            )}
            {props.forks > 0 && (
              <span class="flex items-center gap-1">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 0-1.5 0v.878H6.75v-.878a2.25 2.25 0 1 0-1.5 0ZM8 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
                </svg>
                {Github.num(props.forks)}
              </span>
            )}
            {props.updated && (
              <span>
                Updated {Github.timeAgo(props.updated)}
              </span>
            )}
          </div>
        </div>
        <div class="shrink-0">
          <StarButton />
        </div>
      </div>
    </div>
  )
}

function StarButton() {
  return (
    <span class="inline-flex items-center gap-1 border border-[#30363d] bg-[#21262d] rounded-md px-3 py-1 text-xs text-[#e6edf3] hover:bg-[#30363d] cursor-pointer">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z" />
      </svg>
      Star
    </span>
  )
}

export function LanguageBar(
  props: { languages: { readonly [key: string]: number } },
) {
  const total = Object.values(props.languages).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const sorted = Object.entries(props.languages).sort(([, a], [, b]) => b - a)
  return (
    <div>
      <div class="flex rounded-full overflow-hidden h-2 mb-2">
        {sorted.map(([lang, bytes]) => {
          const pct = ((bytes / total) * 100).toFixed(1)
          return (
            <span
              style={`width: ${pct}%; background-color: ${
                Github.langColor(lang)
              }`}
              title={`${lang} ${pct}%`}
            />
          )
        })}
      </div>
      <div class="flex flex-wrap gap-3 text-xs">
        {sorted.map(([lang, bytes]) => {
          const pct = ((bytes / total) * 100).toFixed(1)
          return (
            <span class="flex items-center gap-1">
              <span
                class="w-2 h-2 rounded-full inline-block"
                style={`background-color: ${Github.langColor(lang)}`}
              />
              <span class="text-[#e6edf3] font-medium">
                {lang}
              </span>
              <span class="text-[#8b949e]">
                {pct}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
