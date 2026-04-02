import * as Schema from "effect/Schema"
import { Route } from "effect-start"
import * as Github from "../../../../Github.ts"
import { Layout, Tabs, IssueRow, StateFilter, EmptyState } from "../../../../Ui.tsx"

export default Route.get(
  Route.schemaPathParams({ owner: Schema.String, repo: Schema.String }),
  Route.schemaSearchParams({ state: Schema.String }),
  Route.html(function* (ctx) {
    const { owner, repo } = ctx.pathParams
    const { state } = ctx.searchParams

    const issues = yield* Github.getRepoIssues(owner, repo, { state, per_page: 50 })
    const filtered = issues.filter((i: any) => !i.pull_request)

    return (
      <Layout>
        <div class="pt-4">
          <RepoHeader owner={owner} repo={repo} />
          <Tabs
            items={[
              { label: "Code", href: Route.link("/:owner/:repo", { owner, repo }) },
              { label: "Issues", href: Route.link("/:owner/:repo/issues", { owner, repo }), active: true },
              { label: "Pull requests", href: Route.link("/:owner/:repo/pulls", { owner, repo }) },
              { label: "Commits", href: Route.link("/:owner/:repo/commits", { owner, repo }) },
              { label: "Contributors", href: Route.link("/:owner/:repo/contributors", { owner, repo }) },
            ]}
          />

          <StateFilter
            current={state}
            openHref={Route.link("/:owner/:repo/issues", { owner, repo, state: "open" })}
            closedHref={Route.link("/:owner/:repo/issues", { owner, repo, state: "closed" })}
          />

          {filtered.length === 0 ? (
            <EmptyState title="No issues found" description={`There are no ${state} issues`} />
          ) : (
            <div class="border border-[#21262d] rounded-md divide-y divide-[#21262d]">
              {filtered.map((issue: any) => (
                <IssueRow
                  number={issue.number}
                  title={issue.title}
                  state={issue.state}
                  user={issue.user?.login ?? "ghost"}
                  comments={issue.comments}
                  created={issue.created_at}
                  labels={[...issue.labels]}
                  owner={owner}
                  repo={repo}
                />
              ))}
            </div>
          )}
        </div>
      </Layout>
    )
  }),
)

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
