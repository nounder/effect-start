import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Route } from "effect-start"
import * as Github from "../../../Github.ts"
import { Layout, RepoCard, Tabs, UserCard } from "../../../Ui.tsx"

export default Route.get(
  Route.schemaPathParams(Schema.Struct({ org: Schema.String })),
  Route.html(function* (ctx) {
    const { org } = ctx.pathParams
    const url = new URL(ctx.request.url)
    const tab = url.searchParams.get("tab") ?? "repositories"

    const [orgInfo, repos, members] = yield* Effect.all([
      Github.getOrg(org),
      Github.getOrgRepos(org, { per_page: 30 }),
      tab === "people" ? Github.getOrgMembers(org, { per_page: 100 }) : Effect.succeed([]),
    ])

    return (
      <Layout>
        <div class="pt-6">
          <div class="flex items-center gap-4 mb-6 pb-6 border-b border-[#21262d]">
            <img src={orgInfo.avatar_url} class="w-20 h-20 rounded-md border border-[#21262d]" />
            <div>
              <h1 class="text-2xl font-bold">{orgInfo.name ?? orgInfo.login}</h1>
              {orgInfo.description && <p class="text-[#8b949e] text-sm mt-1">{orgInfo.description}</p>}
              <div class="flex items-center gap-4 text-sm text-[#8b949e] mt-2 flex-wrap">
                {orgInfo.location && (
                  <span class="flex items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="m12.596 11.596-3.535 3.536a1.5 1.5 0 0 1-2.122 0l-3.535-3.536a6.5 6.5 0 1 1 9.192 0ZM8 1a5 5 0 0 0-3.536 8.536l3.536 3.536 3.536-3.536A5 5 0 0 0 8 1Zm0 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /></svg>
                    {orgInfo.location}
                  </span>
                )}
                {orgInfo.blog && (
                  <a href={orgInfo.blog.startsWith("http") ? orgInfo.blog : `https://${orgInfo.blog}`} class="text-[#58a6ff] hover:underline flex items-center gap-1">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z" /></svg>
                    {orgInfo.blog}
                  </a>
                )}
                <span>{Github.num(orgInfo.public_repos)} repositories</span>
              </div>
            </div>
          </div>

          <Tabs items={[
            { label: "Repositories", href: `/orgs/${org}`, count: orgInfo.public_repos, active: tab === "repositories" },
            { label: "People", href: `/orgs/${org}?tab=people`, active: tab === "people" },
          ]} />

          {tab === "people" ? (
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {members.map((m: any) => (
                <UserCard login={m.login} avatar={m.avatar_url} type="User" />
              ))}
            </div>
          ) : (
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {repos.map((r: any) => (
                <RepoCard
                  name={r.name}
                  fullName={r.full_name}
                  description={r.description}
                  language={r.language}
                  stars={r.stargazers_count}
                  forks={r.forks_count}
                  updated={r.updated_at}
                  topics={r.topics}
                />
              ))}
            </div>
          )}
        </div>
      </Layout>
    )
  }),
)
