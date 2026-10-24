import { Schema } from "effect"
import { Route } from "effect-start"
import * as Github from "../../../../../Github.ts"
import * as Layout from "../../../../../ui/Layout.tsx"
import * as Tabs from "../../../../../ui/Tabs.tsx"

export default Route.get(
  Route.schemaPathParams({
    owner: Schema.String,
    repo: Schema.String,
    sha: Schema.String,
  }),
  Route.html(function* (ctx) {
    const { owner, repo, sha } = ctx.pathParams

    const commit = yield* Github.getCommit(owner, repo, sha)

    const message = commit.commit.message
    const firstLine = message.split("\n")[0]
    const restLines = message.split("\n").slice(1).join("\n").trim()
    const author = commit.author?.login ?? commit.commit.author.name
    const date = commit.commit.author.date
    const stats = commit.stats
    const files = commit.files ?? []

    return (
      <Layout.Layout>
        <div class="pt-4">
          <RepoHeader
            owner={owner}
            repo={repo}
          />
          <Tabs.Tabs
            items={[
              {
                label: "Code",
                href: Route.link("/:owner/:repo", { owner, repo }),
              },
              {
                label: "Issues",
                href: Route.link("/:owner/:repo/issues", { owner, repo }),
              },
              {
                label: "Pull requests",
                href: Route.link("/:owner/:repo/pulls", { owner, repo }),
              },
              {
                label: "Commits",
                href: Route.link("/:owner/:repo/commits", { owner, repo }),
                active: true,
              },
              {
                label: "Contributors",
                href: Route.link("/:owner/:repo/contributors", { owner, repo }),
              },
            ]}
          />

          <div class="mb-6 rounded-md border border-[#21262d]">
            <div class="rounded-t-md bg-[#161b22] p-4">
              <h1 class="mb-1 text-lg font-semibold">{firstLine}</h1>
              {restLines && (
                <pre class="mt-2 text-sm whitespace-pre-wrap text-[#8b949e]">{restLines}</pre>
              )}
            </div>
            <div class="flex items-center gap-3 border-t border-[#21262d] px-4 py-3 text-sm">
              {commit.author?.avatar_url && (
                <img
                  src={commit.author.avatar_url}
                  class="h-5 w-5 rounded-full"
                />
              )}
              <a
                href={Route.link("/:owner", { owner: author })}
                class="font-semibold text-[#e6edf3] hover:text-[#58a6ff]"
              >
                {author}
              </a>
              <span class="text-[#8b949e]">committed {Github.timeAgo(date)}</span>
              <code class="ml-auto font-mono text-xs text-[#8b949e]">{commit.sha}</code>
            </div>
          </div>

          <div class="mb-4 flex items-center gap-4 border-b border-[#21262d] pb-4 text-sm">
            <span class="text-[#8b949e]">
              Showing <span class="font-semibold text-[#e6edf3]">{files.length}</span> changed files
            </span>
            {stats && <span class="text-[#3fb950]">+{stats.additions}</span>}
            {stats && <span class="text-[#f85149]">-{stats.deletions}</span>}
          </div>

          <div class="space-y-3">
            {files.map((f) => (
              <div class="rounded-md border border-[#21262d]">
                <div class="flex items-center gap-2 rounded-t-md border-b border-[#21262d] bg-[#161b22] px-4 py-2 text-sm">
                  <span
                    class={`rounded px-1.5 py-0.5 font-mono text-xs ${
                      f.status === "added"
                        ? "bg-[#238636] text-white"
                        : f.status === "removed"
                          ? "bg-[#da3633] text-white"
                          : f.status === "renamed"
                            ? "bg-[#8957e5] text-white"
                            : "bg-[#d29922] text-white"
                    }`}
                  >
                    {f.status === "added"
                      ? "A"
                      : f.status === "removed"
                        ? "D"
                        : f.status === "renamed"
                          ? "R"
                          : "M"}
                  </span>
                  <span class="font-mono text-[#e6edf3]">{f.filename}</span>
                  <span class="ml-auto text-[#8b949e]">
                    {f.additions > 0 && <span class="text-[#3fb950]">+{f.additions}</span>}
                    {f.deletions > 0 && <span class="text-[#f85149]">-{f.deletions}</span>}
                  </span>
                </div>
                {f.patch && (
                  <pre class="overflow-x-auto p-3 font-mono text-xs leading-5 whitespace-pre text-[#8b949e]">
                    {f.patch}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </Layout.Layout>
    )
  }),
)

function RepoHeader(props: { owner: string; repo: string }) {
  return (
    <div class="mb-4 flex items-center gap-2 text-xl">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="#8b949e"
      >
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
        href={Route.link("/:owner/:repo", {
          owner: props.owner,
          repo: props.repo,
        })}
        class="font-bold text-[#58a6ff] hover:underline"
      >
        {props.repo}
      </a>
    </div>
  )
}
