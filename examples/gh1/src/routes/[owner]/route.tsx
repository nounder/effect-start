import * as Schema from "effect/Schema"
import { Route } from "effect-start"
import * as Github from "../../Github.ts"
import { Layout, RepoCard, Tabs } from "../../Ui.tsx"

export default Route.get(
  Route.schemaPathParams(Schema.Struct({ owner: Schema.String })),
  Route.html(function* (ctx) {
    const { owner } = ctx.pathParams
    const url = new URL(ctx.request.url)
    const tab = url.searchParams.get("tab") ?? "repositories"

    const user = yield* Github.getUser(owner)
    const isOrg = user.type === "Organization"

    if (isOrg) {
      const repos = yield* Github.getOrgRepos(owner, { per_page: 30 })
      return renderOrg(user, repos)
    }

    const displayRepos = yield* tab === "stars"
      ? Github.getUserStarred(owner, { per_page: 30 })
      : Github.getUserRepos(owner, { sort: "updated", per_page: 30 })

    return (
      <Layout>
        <div class="flex flex-col lg:flex-row gap-8 pt-4">
          <aside class="lg:w-[296px] shrink-0">
            <img
              src={user.avatar_url}
              class="w-[296px] h-[296px] rounded-full border-2 border-[#21262d] mb-4"
            />
            <h1 class="text-2xl font-bold">{user.name ?? user.login}</h1>
            <h2 class="text-xl text-[#8b949e] font-light mb-2">{user.login}</h2>
            {user.bio && <p class="text-sm text-[#8b949e] mb-4">{user.bio}</p>}

            <div class="flex items-center gap-2 text-sm text-[#8b949e] mb-4">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4.001 4.001 0 0 0-6.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a.75.75 0 1 0 0 1.5 1.5 1.5 0 0 1 .666 2.844.75.75 0 0 0-.416.672v.352a.75.75 0 0 0 .574.73c1.2.289 2.162 1.2 2.522 2.372a.75.75 0 1 0 1.434-.44 5.01 5.01 0 0 0-2.56-3.012A3 3 0 0 0 11 4Z" />
              </svg>
              <a href={`/${owner}?tab=followers`} class="hover:text-[#58a6ff]">
                <span class="font-semibold text-[#e6edf3]">{Github.num(user.followers)}</span>{" "}
                followers
              </a>
              <span>·</span>
              <a href={`/${owner}?tab=following`} class="hover:text-[#58a6ff]">
                <span class="font-semibold text-[#e6edf3]">{Github.num(user.following)}</span>{" "}
                following
              </a>
            </div>

            <div class="flex flex-col gap-1 text-sm text-[#8b949e]">
              {user.company && (
                <div class="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.75 16A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0h8.5C11.216 0 12 .784 12 1.75v12.5c0 .085-.006.168-.018.25h2.268a.25.25 0 0 0 .25-.25V8.285a.25.25 0 0 0-.111-.208l-1.055-.703a.749.749 0 1 1 .832-1.248l1.055.703c.487.325.779.871.779 1.456v5.965A1.75 1.75 0 0 1 14.25 16h-3.5a.766.766 0 0 1-.197-.026c-.099.017-.2.026-.303.026h-3a.75.75 0 0 1-.75-.75V14h-1v1.25a.75.75 0 0 1-.75.75Zm-.25-1.75c0 .138.112.25.25.25H4v-1.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75v1.25h2.25a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25ZM3.75 6h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 3.75A.75.75 0 0 1 3.75 3h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 3.75Zm4 3A.75.75 0 0 1 7.75 6h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 7 6.75ZM7.75 3h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 9.75A.75.75 0 0 1 3.75 9h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 9.75ZM7.75 9h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5Z" />
                  </svg>
                  {user.company}
                </div>
              )}
              {user.location && (
                <div class="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="m12.596 11.596-3.535 3.536a1.5 1.5 0 0 1-2.122 0l-3.535-3.536a6.5 6.5 0 1 1 9.192 0ZM8 1a5 5 0 0 0-3.536 8.536l3.536 3.536 3.536-3.536A5 5 0 0 0 8 1Zm0 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                  </svg>
                  {user.location}
                </div>
              )}
              {user.blog && (
                <div class="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z" />
                  </svg>
                  <a
                    href={user.blog.startsWith("http") ? user.blog : `https://${user.blog}`}
                    class="text-[#58a6ff] hover:underline truncate"
                  >
                    {user.blog}
                  </a>
                </div>
              )}
              {user.twitter_username && (
                <div class="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M9.294 6.928 14.357 1h-1.2L8.762 6.147 5.25 1H1.2l5.31 7.784L1.2 15h1.2l4.642-5.436L10.751 15h4.05L9.294 6.928ZM7.651 8.852l-.538-.775L2.832 1.91h1.843l3.454 4.977.538.775 4.491 6.47h-1.843L7.651 8.852Z" />
                  </svg>
                  <a
                    href={`https://x.com/${user.twitter_username}`}
                    class="text-[#58a6ff] hover:underline"
                  >
                    @{user.twitter_username}
                  </a>
                </div>
              )}
            </div>
          </aside>

          <div class="flex-1 min-w-0">
            <Tabs
              items={[
                {
                  label: "Repositories",
                  href: `/${owner}`,
                  count: user.public_repos,
                  active: tab === "repositories",
                },
                { label: "Stars", href: `/${owner}?tab=stars`, active: tab === "stars" },
              ]}
            />

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...displayRepos].map((r) => (
                <RepoCard
                  name={r.name}
                  fullName={r.full_name}
                  description={r.description}
                  language={r.language}
                  stars={r.stargazers_count}
                  forks={r.forks_count}
                  updated={r.updated_at ?? r.pushed_at}
                  topics={r.topics ? [...r.topics] : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    )
  }),
)

function renderOrg(org: Github.User, repos: readonly Github.Repo[]) {
  return (
    <Layout>
      <div class="pt-6">
        <div class="flex items-center gap-4 mb-6">
          <img src={org.avatar_url} class="w-20 h-20 rounded-md border border-[#21262d]" />
          <div>
            <h1 class="text-2xl font-bold">{org.name ?? org.login}</h1>
            {org.bio && <p class="text-[#8b949e] text-sm mt-1">{org.bio}</p>}
            <div class="flex items-center gap-4 text-sm text-[#8b949e] mt-2">
              {org.location && <span>{org.location}</span>}
              {org.blog && (
                <a
                  href={org.blog.startsWith("http") ? org.blog : `https://${org.blog}`}
                  class="text-[#58a6ff] hover:underline"
                >
                  {org.blog}
                </a>
              )}
              <span>{Github.num(org.public_repos)} repositories</span>
            </div>
          </div>
        </div>

        <Tabs
          items={[
            {
              label: "Repositories",
              href: `/orgs/${org.login}`,
              count: org.public_repos,
              active: true,
            },
          ]}
        />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {repos.map((r) => (
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
      </div>
    </Layout>
  )
}
