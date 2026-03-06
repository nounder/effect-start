import * as Github from "./Github.ts"

export function ErrorPage(props: {
  title: string
  message?: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <Layout>
      <div class="pt-16 text-center">
        <h1 class="text-3xl font-bold mb-2">{props.title}</h1>
        {props.message && <p class="text-[#8b949e] mb-4">{props.message}</p>}
        {props.backHref && (
          <a href={props.backHref} class="text-[#58a6ff] hover:underline">
            {props.backLabel ?? "Go back"}
          </a>
        )}
      </div>
    </Layout>
  )
}

export function Layout(props: { title?: string; children: any }) {
  return (
    <div class="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <Nav />
      <main class="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">{props.children}</main>
      <footer class="border-t border-[#21262d] mt-12 py-8 text-center text-xs text-[#8b949e]">
        <div class="max-w-[1280px] mx-auto px-4">
          Built with{" "}
          <a href="https://github.com/effect-ts/effect" class="text-[#58a6ff] hover:underline">
            Effect
          </a>{" "}
          +{" "}
          <a
            href="https://github.com/nikitavoloboev/effect-start"
            class="text-[#58a6ff] hover:underline"
          >
            effect-start
          </a>
        </div>
      </footer>
    </div>
  )
}

export function Nav() {
  return (
    <nav class="bg-[#161b22] border-b border-[#21262d] px-4 sm:px-6 lg:px-8 py-3">
      <div class="max-w-[1280px] mx-auto flex items-center gap-4">
        <a href="/" class="text-white hover:text-[#e6edf3]">
          <svg height="32" viewBox="0 0 16 16" width="32" fill="currentColor">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
          </svg>
        </a>
        <form action="/search" method="get" class="flex-1 max-w-[540px]">
          <input
            type="text"
            name="q"
            placeholder="Search GitHub..."
            class="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-1.5 text-sm text-[#e6edf3] placeholder-[#8b949e] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]"
          />
        </form>
        <div class="flex items-center gap-4 text-sm">
          <a href="/" class="text-[#e6edf3] hover:text-white">
            Explore
          </a>
        </div>
      </div>
    </nav>
  )
}

export function RepoCard(props: {
  name: string
  fullName: string
  description?: string | null
  language?: string | null
  stars: number
  forks: number
  updated?: string | null
  topics?: readonly string[]
}) {
  return (
    <div class="border border-[#21262d] rounded-md p-4 hover:border-[#30363d] transition-colors">
      <div class="flex items-start justify-between gap-2 mb-1">
        <h3 class="text-[#58a6ff] font-semibold text-sm truncate">
          <a href={`/${props.fullName}`} class="hover:underline">
            {props.fullName}
          </a>
        </h3>
        <span class="text-[#8b949e] border border-[#30363d] rounded-full text-xs px-2 py-0.5 shrink-0">
          Public
        </span>
      </div>
      {props.description && (
        <p class="text-[#8b949e] text-xs mb-3 line-clamp-2">{props.description}</p>
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
            {props.language}
          </span>
        )}
        {props.stars > 0 && (
          <a href={`/${props.fullName}`} class="flex items-center gap-1 hover:text-[#58a6ff]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
            </svg>
            {Github.num(props.stars)}
          </a>
        )}
        {props.forks > 0 && (
          <a href={`/${props.fullName}`} class="flex items-center gap-1 hover:text-[#58a6ff]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 0-1.5 0v.878H6.75v-.878a2.25 2.25 0 1 0-1.5 0ZM8 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
            </svg>
            {Github.num(props.forks)}
          </a>
        )}
        {props.updated && <span>Updated {Github.timeAgo(props.updated)}</span>}
      </div>
    </div>
  )
}

export function RepoListItem(props: {
  fullName: string
  description?: string | null
  language?: string | null
  stars: number
  forks: number
  updated?: string | null
  topics?: readonly string[]
}) {
  return (
    <div class="py-6 border-b border-[#21262d]">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h3 class="text-xl mb-1">
            <a href={`/${props.fullName}`} class="text-[#58a6ff] font-semibold hover:underline">
              {props.fullName}
            </a>
          </h3>
          {props.description && (
            <p class="text-[#8b949e] text-sm mb-2 max-w-[680px]">{props.description}</p>
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
                  style={`background-color: ${Github.langColor(props.language)}`}
                />
                {props.language}
              </span>
            )}
            {props.stars > 0 && (
              <span class="flex items-center gap-1">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                </svg>
                {Github.num(props.stars)}
              </span>
            )}
            {props.forks > 0 && (
              <span class="flex items-center gap-1">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 0-1.5 0v.878H6.75v-.878a2.25 2.25 0 1 0-1.5 0ZM8 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
                </svg>
                {Github.num(props.forks)}
              </span>
            )}
            {props.updated && <span>Updated {Github.timeAgo(props.updated)}</span>}
          </div>
        </div>
        <div class="shrink-0">
          <StarButton />
        </div>
      </div>
    </div>
  )
}

export function StarButton() {
  return (
    <span class="inline-flex items-center gap-1 border border-[#30363d] bg-[#21262d] rounded-md px-3 py-1 text-xs text-[#e6edf3] hover:bg-[#30363d] cursor-pointer">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z" />
      </svg>
      Star
    </span>
  )
}

export function UserCard(props: {
  login: string
  avatar: string
  name?: string
  bio?: string
  type?: string
}) {
  const href = props.type === "Organization" ? `/orgs/${props.login}` : `/${props.login}`
  return (
    <a
      href={href}
      class="flex items-center gap-3 p-3 rounded-md hover:bg-[#161b22] transition-colors"
    >
      <img
        src={props.avatar}
        alt={props.login}
        class={`w-10 h-10 ${props.type === "Organization" ? "rounded-md" : "rounded-full"} bg-[#21262d]`}
      />
      <div class="min-w-0">
        <div class="text-[#58a6ff] text-sm font-medium truncate">{props.login}</div>
        {props.name && <div class="text-[#8b949e] text-xs truncate">{props.name}</div>}
      </div>
    </a>
  )
}

export function IssueRow(props: {
  number: number
  title: string
  state: string
  user: string
  comments: number
  created: string
  labels?: ReadonlyArray<{ readonly name: string; readonly color: string }>
  isPr?: boolean
  repoPath: string
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
      <span class="mt-1 shrink-0" dangerouslySetInnerHTML={{ __html: icon }} />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <a
            href={`/${props.repoPath}/issues/${props.number}`}
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

export function CommitRow(props: {
  sha: string
  message: string
  author: string
  avatar?: string
  date: string
  repoPath: string
}) {
  const shortSha = props.sha.slice(0, 7)
  const firstLine = props.message.split("\n")[0]
  return (
    <div class="flex items-center gap-3 py-2 px-3 hover:bg-[#161b22] rounded">
      {props.avatar && <img src={props.avatar} class="w-5 h-5 rounded-full shrink-0" />}
      <div class="flex-1 min-w-0">
        <a
          href={`/${props.repoPath}/commit/${props.sha}`}
          class="text-sm text-[#e6edf3] font-medium hover:text-[#58a6ff] truncate block"
        >
          {firstLine}
        </a>
        <div class="text-xs text-[#8b949e]">
          <span class="font-medium text-[#e6edf3]">{props.author}</span> committed{" "}
          {Github.timeAgo(props.date)}
        </div>
      </div>
      <code class="text-xs text-[#58a6ff] bg-[#388bfd1a] px-2 py-0.5 rounded shrink-0 font-mono hover:bg-[#58a6ff] hover:text-white transition-colors cursor-pointer">
        {shortSha}
      </code>
    </div>
  )
}

export function ContributorCard(props: { login: string; avatar: string; contributions: number }) {
  return (
    <a
      href={`/${props.login}`}
      class="flex items-center gap-2 p-2 rounded hover:bg-[#161b22] transition-colors"
    >
      <img src={props.avatar} class="w-8 h-8 rounded-full bg-[#21262d]" />
      <div class="min-w-0">
        <div class="text-sm text-[#58a6ff] font-medium truncate">{props.login}</div>
        <div class="text-xs text-[#8b949e]">{Github.num(props.contributions)} commits</div>
      </div>
    </a>
  )
}

export function Stat(props: { label: string; value: string | number; icon?: string }) {
  return (
    <div class="flex items-center gap-2 text-sm text-[#8b949e]">
      {props.icon && <span dangerouslySetInnerHTML={{ __html: props.icon }} />}
      <span class="font-medium text-[#e6edf3]">{props.value}</span>
      <span>{props.label}</span>
    </div>
  )
}

export function Tabs(props: {
  items: Array<{ label: string; href: string; count?: number; active?: boolean }>
}) {
  return (
    <div class="flex gap-0 border-b border-[#21262d] mb-4 overflow-x-auto">
      {props.items.map((item) => (
        <a
          href={item.href}
          class={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 whitespace-nowrap transition-colors ${
            item.active
              ? "border-[#f78166] text-[#e6edf3] font-semibold"
              : "border-transparent text-[#8b949e] hover:text-[#e6edf3] hover:border-[#21262d]"
          }`}
        >
          {item.label}
          {item.count !== undefined && (
            <span class="bg-[#21262d] text-[#8b949e] rounded-full text-xs px-2 py-0.5">
              {Github.num(item.count)}
            </span>
          )}
        </a>
      ))}
    </div>
  )
}

export function EmptyState(props: { icon?: string; title: string; description?: string }) {
  return (
    <div class="text-center py-12">
      {props.icon && <div class="text-[#8b949e] text-4xl mb-4">{props.icon}</div>}
      <h3 class="text-xl text-[#e6edf3] mb-2">{props.title}</h3>
      {props.description && <p class="text-[#8b949e] text-sm">{props.description}</p>}
    </div>
  )
}

export function LanguageBar(props: { languages: { readonly [key: string]: number } }) {
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
              style={`width: ${pct}%; background-color: ${Github.langColor(lang)}`}
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
              <span class="text-[#e6edf3] font-medium">{lang}</span>
              <span class="text-[#8b949e]">{pct}%</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function StateFilter(props: {
  current: string
  base: string
  counts?: { open?: number; closed?: number }
}) {
  return (
    <div class="flex gap-2 mb-4 text-sm">
      <a
        href={`${props.base}?state=open`}
        class={`flex items-center gap-1 ${props.current === "open" ? "text-[#e6edf3] font-semibold" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="#3fb950">
          <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
        </svg>
        {props.counts?.open !== undefined ? `${Github.num(props.counts.open)} Open` : "Open"}
      </a>
      <a
        href={`${props.base}?state=closed`}
        class={`flex items-center gap-1 ${props.current === "closed" ? "text-[#e6edf3] font-semibold" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
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
