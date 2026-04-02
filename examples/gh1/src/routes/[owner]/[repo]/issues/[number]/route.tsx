import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Route } from "effect-start"
import * as Github from "../../../../../Github.ts"
import { Layout, Tabs } from "../../../../../Ui.tsx"

export default Route.get(
  Route.schemaPathParams({ owner: Schema.String, repo: Schema.String, number: Schema.NumberFromString }),
  Route.html(function* (ctx) {
    const { owner, repo, number } = ctx.pathParams

    const [issue, comments] = yield* Effect.all([
      Github.getIssue(owner, repo, number),
      Github.getIssueComments(owner, repo, number),
    ])

    const isPr = !!issue.pull_request
    const isOpen = issue.state === "open"

    return (
      <Layout>
        <div class="pt-4">
          <RepoHeader owner={owner} repo={repo} />
          <Tabs
            items={[
              { label: "Code", href: Route.link("/:owner/:repo", { owner, repo }) },
              { label: "Issues", href: Route.link("/:owner/:repo/issues", { owner, repo }), active: !isPr },
              { label: "Pull requests", href: Route.link("/:owner/:repo/pulls", { owner, repo }), active: isPr },
              { label: "Commits", href: Route.link("/:owner/:repo/commits", { owner, repo }) },
              { label: "Contributors", href: Route.link("/:owner/:repo/contributors", { owner, repo }) },
            ]}
          />

          <div class="max-w-[960px]">
            <h1 class="text-2xl font-normal mb-2">
              <span>{issue.title}</span>
              <span class="text-[#8b949e] font-light"> #{number}</span>
            </h1>

            <div class="flex items-center gap-2 mb-6 pb-4 border-b border-[#21262d]">
              <span
                class={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                  isOpen
                    ? "bg-[#238636] text-white"
                    : issue.state_reason === "not_planned"
                      ? "bg-[#8b949e] text-white"
                      : "bg-[#8957e5] text-white"
                }`}
              >
                {isOpen ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L8 7.94 5.78 5.72a.75.75 0 0 0-1.06 1.06L6.94 9l-2.22 2.22a.75.75 0 1 0 1.06 1.06L8 10.06l2.22 2.22a.75.75 0 1 0 1.06-1.06L9.06 9l2.22-2.22Z" />
                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
                  </svg>
                )}
                {isOpen ? "Open" : "Closed"}
              </span>
              <span class="text-sm text-[#8b949e]">
                {issue.user && (
                  <a
                    href={Route.link("/:owner", { owner: issue.user.login })}
                    class="font-semibold text-[#e6edf3] hover:text-[#58a6ff]"
                  >
                    {issue.user.login}
                  </a>
                )}{" "}
                opened this issue {Github.timeAgo(issue.created_at)}
                {" · "}
                {issue.comments} comment{issue.comments !== 1 ? "s" : ""}
              </span>
            </div>

            {issue.labels.length > 0 && (
              <div class="flex flex-wrap gap-1 mb-4">
                {issue.labels.map((l) => (
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
              login={issue.user?.login ?? "ghost"}
              avatar={issue.user?.avatar_url ?? ""}
              date={issue.created_at}
              body={issue.body}
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
      <a href={Route.link("/:owner", { owner: props.owner })} class="text-[#58a6ff] hover:underline">
        {props.owner}
      </a>
      <span class="text-[#8b949e]">/</span>
      <a href={Route.link("/:owner/:repo", { owner: props.owner, repo: props.repo })} class="text-[#58a6ff] font-bold hover:underline">
        {props.repo}
      </a>
    </div>
  )
}
