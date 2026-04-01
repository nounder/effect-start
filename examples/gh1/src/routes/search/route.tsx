import { Route } from "effect-start"
import * as Github from "../../Github.ts"
import { Layout, RepoListItem, UserCard, EmptyState } from "../../Ui.tsx"

export default Route.get(
  Route.html(function* (ctx) {
    const url = new URL(ctx.request.url)
    const q = url.searchParams.get("q") ?? ""
    const type = url.searchParams.get("type") ?? "repositories"
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)

    if (!q) {
      return (
        <Layout>
          <div class="pt-12">
            <EmptyState title="Search GitHub" description="Enter a query in the search bar above" />
          </div>
        </Layout>
      )
    }

    if (type === "users") {
      const results = yield* Github.searchUsers(q, { per_page: 30, page })
      const users = results.items
      return (
        <Layout>
          <div class="pt-6 pb-4">
            <h2 class="text-xl font-semibold mb-4">
              <span class="text-[#8b949e]">{Github.num(results.total_count)} users matching</span> "
              {q}"
            </h2>
            <SearchTabs q={q} active="users" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {users.map((u) => (
              <UserCard login={u.login} avatar={u.avatar_url} type={u.type} />
            ))}
          </div>
          {users.length === 30 && <Pagination q={q} type={type} page={page} />}
        </Layout>
      )
    }

    const results = yield* Github.searchRepos(q, { per_page: 30, page })
    const repos = results.items
    return (
      <Layout>
        <div class="pt-6 pb-4">
          <h2 class="text-xl font-semibold mb-4">
            <span class="text-[#8b949e]">{Github.num(results.total_count)} results matching</span> "
            {q}"
          </h2>
          <SearchTabs q={q} active="repositories" />
        </div>
        <div>
          {repos.map((r) => (
            <RepoListItem
              owner={r.owner.login}
              repo={r.name}
              description={r.description}
              language={r.language}
              stars={r.stargazers_count}
              forks={r.forks_count}
              updated={r.updated_at}
              topics={r.topics ? [...r.topics] : undefined}
            />
          ))}
        </div>
        {repos.length === 0 && (
          <EmptyState title="No results" description={`Nothing matched "${q}"`} />
        )}
        {repos.length === 30 && <Pagination q={q} type={type} page={page} />}
      </Layout>
    )
  }),
)

function SearchTabs(props: { q: string; active: string }) {
  return (
    <div class="flex gap-0 border-b border-[#21262d] mb-4">
      <a
        href={`/search?q=${encodeURIComponent(props.q)}&type=repositories`}
        class={`px-4 py-2 text-sm border-b-2 ${
          props.active === "repositories"
            ? "border-[#f78166] text-[#e6edf3] font-semibold"
            : "border-transparent text-[#8b949e] hover:text-[#e6edf3]"
        }`}
      >
        Repositories
      </a>
      <a
        href={`/search?q=${encodeURIComponent(props.q)}&type=users`}
        class={`px-4 py-2 text-sm border-b-2 ${
          props.active === "users"
            ? "border-[#f78166] text-[#e6edf3] font-semibold"
            : "border-transparent text-[#8b949e] hover:text-[#e6edf3]"
        }`}
      >
        Users
      </a>
    </div>
  )
}

function Pagination(props: { q: string; type: string; page: number }) {
  return (
    <div class="flex justify-center gap-2 py-8">
      {props.page > 1 && (
        <a
          href={`/search?q=${encodeURIComponent(props.q)}&type=${props.type}&page=${props.page - 1}`}
          class="px-4 py-2 border border-[#30363d] rounded-md text-sm text-[#58a6ff] hover:bg-[#21262d]"
        >
          Previous
        </a>
      )}
      <a
        href={`/search?q=${encodeURIComponent(props.q)}&type=${props.type}&page=${props.page + 1}`}
        class="px-4 py-2 border border-[#30363d] rounded-md text-sm text-[#58a6ff] hover:bg-[#21262d]"
      >
        Next
      </a>
    </div>
  )
}
