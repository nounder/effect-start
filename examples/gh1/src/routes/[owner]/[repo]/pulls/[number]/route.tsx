import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Route } from "effect-start"
import * as Github from "../../../../../Github.ts"
import { Layout, Tabs } from "../../../../../Ui.tsx"

export default Route.get(
  Route.schemaPathParams({ owner: Schema.String, repo: Schema.String, number: Schema.NumberFromString }),
  Route.html(function* (ctx) {
    const { owner, repo, number } = ctx.pathParams

    const [pr, comments] = yield* Effect.all([
      Github.getPull(owner, repo, number),
      Github.getIssueComments(owner, repo, number),
    ])

    const isOpen = pr.state === "open"
    const isMerged = !!pr.merged_at

    return (
      <Layout>
        <div class="pt-4">
          <RepoHeader owner={owner} repo={repo} />
          <Tabs
            items={[
              { label: "Code", href: Route.link("/:owner/:repo", { owner, repo }) },
              { label: "Issues", href: Route.link("/:owner/:repo/issues", { owner, repo }) },
              {
                label: "Pull requests",
                href: Route.link("/:owner/:repo/pulls", { owner, repo }),
                active: true,
              },
              { label: "Commits", href: Route.link("/:owner/:repo/commits", { owner, repo }) },
              {
                label: "Contributors",
                href: Route.link("/:owner/:repo/contributors", { owner, repo }),
              },
            ]}
          />

          <div class="max-w-[960px]">
            <h1 class="text-2xl font-normal mb-2">
              <span>{pr.title}</span>
              <span class="text-[#8b949e] font-light"> #{number}</span>
            </h1>

            <div class="flex items-center gap-2 mb-6 pb-4 border-b border-[#21262d]">
              <span
                class={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                  isMerged
                    ? "bg-[#8957e5] text-white"
                    : isOpen
                      ? "bg-[#238636] text-white"
                      : "bg-[#da3633] text-white"
                }`}
              >
                {isMerged ? "Merged" : isOpen ? "Open" : "Closed"}
              </span>
              <span class="text-sm text-[#8b949e]">
                {pr.user && (
                  <a
                    href={Route.link("/:owner", { owner: pr.user.login })}
                    class="font-semibold text-[#e6edf3] hover:text-[#58a6ff]"
                  >
                    {pr.user.login}
                  </a>
                )}{" "}
                wants to merge into{" "}
                <code class="px-1.5 py-0.5 bg-[#388bfd1a] text-[#58a6ff] rounded text-xs">
                  {pr.base?.label}
                </code>{" "}
                from{" "}
                <code class="px-1.5 py-0.5 bg-[#388bfd1a] text-[#58a6ff] rounded text-xs">
                  {pr.head?.label}
                </code>
              </span>
            </div>

            <div class="flex items-center gap-4 text-sm text-[#8b949e] mb-6">
              {pr.commits !== undefined && <span>{pr.commits} commits</span>}
              {pr.changed_files !== undefined && <span>{pr.changed_files} files changed</span>}
              {pr.additions !== undefined && <span class="text-[#3fb950]">+{pr.additions}</span>}
              {pr.deletions !== undefined && <span class="text-[#f85149]">-{pr.deletions}</span>}
            </div>

            {pr.labels.length > 0 && (
              <div class="flex flex-wrap gap-1 mb-4">
                {pr.labels.map((l) => (
                  <span
                    class="text-xs rounded-full px-2.5 py-0.5 font-medium border"
                    style={`color: #${l.color}; border-color: #${l.color}40; background-color: #${l.color}18`}
                  >
                    {l.name}
                  </span>
                ))}
              </div>
            )}

            <Comment
              login={pr.user?.login ?? "ghost"}
              avatar={pr.user?.avatar_url ?? ""}
              date={pr.created_at}
              body={pr.body}
              isAuthor={true}
            />

            {comments.map((c) => (
              <Comment
                login={c.user?.login ?? "ghost"}
                avatar={c.user?.avatar_url ?? ""}
                date={c.created_at}
                body={c.body}
              />
            ))}
          </div>
        </div>
      </Layout>
    )
  }),
)

function Comment(props: {
  login: string
  avatar: string
  date: string
  body?: string | null
  isAuthor?: boolean
}) {
  return (
    <div class="mb-4">
      <div class="border border-[#21262d] rounded-md">
        <div class="flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-[#21262d] rounded-t-md">
          <img src={props.avatar} class="w-5 h-5 rounded-full" />
          <a
            href={Route.link("/:owner", { owner: props.login })}
            class="text-sm font-semibold text-[#e6edf3] hover:text-[#58a6ff]"
          >
            {props.login}
          </a>
          <span class="text-xs text-[#8b949e]">commented {Github.timeAgo(props.date)}</span>
          {props.isAuthor && (
            <span class="text-xs border border-[#30363d] rounded-full px-2 py-0.5 text-[#8b949e]">
              Author
            </span>
          )}
        </div>
        <div class="p-4 markdown-body text-sm">
          {props.body ? (
            <div style="white-space: pre-wrap; word-break: break-word;">{props.body}</div>
          ) : (
            <p class="text-[#8b949e] italic">No description provided.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function RepoHeader(props: { owner: string; repo: string }) {
  return (
    <div class="flex items-center gap-2 text-xl mb-4">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#8b949e">
        <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
      </svg>
      <a
        href={Route.link("/:owner", { owner: props.owner })}
        class="text-[#58a6ff] hover:underline"
      >
        {props.owner}
      </a>
      <span class="text-[#8b949e]">/</span>
      <a
        href={Route.link("/:owner/:repo", { owner: props.owner, repo: props.repo })}
        class="text-[#58a6ff] font-bold hover:underline"
      >
        {props.repo}
      </a>
    </div>
  )
}
