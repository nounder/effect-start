import * as Schema from "effect/Schema"
import { Route } from "effect-start"
import * as Github from "../../../../../Github.ts"
import { Layout, Tabs } from "../../../../../Ui.tsx"

export default Route.get(
  Route.schemaPathParams(Schema.Struct({ owner: Schema.String, repo: Schema.String, sha: Schema.String })),
  Route.html(function* (ctx) {
    const { owner, repo, sha } = ctx.pathParams
    const path = `${owner}/${repo}`

    const commit = yield* Github.getCommit(owner, repo, sha)

    const message = commit.commit.message
    const firstLine = message.split("\n")[0]
    const restLines = message.split("\n").slice(1).join("\n").trim()
    const author = commit.author?.login ?? commit.commit.author.name
    const date = commit.commit.author.date
    const stats = commit.stats
    const files = commit.files ?? []

    return (
      <Layout>
        <div class="pt-4">
          <RepoHeader owner={owner} repo={repo} />
          <Tabs items={[
            { label: "Code", href: `/${path}` },
            { label: "Issues", href: `/${path}/issues` },
            { label: "Pull requests", href: `/${path}/pulls` },
            { label: "Commits", href: `/${path}/commits`, active: true },
            { label: "Contributors", href: `/${path}/contributors` },
          ]} />

          <div class="border border-[#21262d] rounded-md mb-6">
            <div class="p-4 bg-[#161b22] rounded-t-md">
              <h1 class="text-lg font-semibold mb-1">{firstLine}</h1>
              {restLines && <pre class="text-sm text-[#8b949e] mt-2 whitespace-pre-wrap">{restLines}</pre>}
            </div>
            <div class="flex items-center gap-3 px-4 py-3 text-sm border-t border-[#21262d]">
              {commit.author?.avatar_url && <img src={commit.author.avatar_url} class="w-5 h-5 rounded-full" />}
              <a href={`/${author}`} class="font-semibold text-[#e6edf3] hover:text-[#58a6ff]">{author}</a>
              <span class="text-[#8b949e]">committed {Github.timeAgo(date)}</span>
              <code class="ml-auto text-xs text-[#8b949e] font-mono">{commit.sha}</code>
            </div>
          </div>

          <div class="flex items-center gap-4 text-sm mb-4 pb-4 border-b border-[#21262d]">
            <span class="text-[#8b949e]">Showing <span class="font-semibold text-[#e6edf3]">{files.length}</span> changed files</span>
            {stats && <span class="text-[#3fb950]">+{stats.additions}</span>}
            {stats && <span class="text-[#f85149]">-{stats.deletions}</span>}
          </div>

          <div class="space-y-3">
            {files.map((f) => (
              <div class="border border-[#21262d] rounded-md">
                <div class="flex items-center gap-2 px-4 py-2 bg-[#161b22] border-b border-[#21262d] rounded-t-md text-sm">
                  <span class={`font-mono text-xs px-1.5 py-0.5 rounded ${
                    f.status === "added" ? "bg-[#238636] text-white" :
                    f.status === "removed" ? "bg-[#da3633] text-white" :
                    f.status === "renamed" ? "bg-[#8957e5] text-white" :
                    "bg-[#d29922] text-white"
                  }`}>
                    {f.status === "added" ? "A" : f.status === "removed" ? "D" : f.status === "renamed" ? "R" : "M"}
                  </span>
                  <span class="font-mono text-[#e6edf3]">{f.filename}</span>
                  <span class="ml-auto text-[#8b949e]">
                    {f.additions > 0 && <span class="text-[#3fb950]">+{f.additions} </span>}
                    {f.deletions > 0 && <span class="text-[#f85149]">-{f.deletions}</span>}
                  </span>
                </div>
                {f.patch && <pre class="p-3 text-xs font-mono overflow-x-auto text-[#8b949e] leading-5 whitespace-pre">{f.patch}</pre>}
              </div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }),
)

function RepoHeader(props: { owner: string; repo: string }) {
  return (
    <div class="flex items-center gap-2 text-xl mb-4">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#8b949e"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" /></svg>
      <a href={`/${props.owner}`} class="text-[#58a6ff] hover:underline">{props.owner}</a>
      <span class="text-[#8b949e]">/</span>
      <a href={`/${props.owner}/${props.repo}`} class="text-[#58a6ff] font-bold hover:underline">{props.repo}</a>
    </div>
  )
}
