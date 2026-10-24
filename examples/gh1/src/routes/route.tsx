import { Route } from "effect-start"
import * as Github from "../Github.ts"
import * as Layout from "../ui/Layout.tsx"
import * as Repo from "../ui/Repo.tsx"

export default Route.get(
  Route.html(function* () {
    const trending = yield* Github.getTrending({ since: "weekly" })
    const repos = trending.items

    return (
      <Layout.Layout>
        <div class="mb-8 pt-8 pb-4">
          <h1 class="mb-1 text-3xl font-bold">Explore</h1>
          <p class="text-base text-[#8b949e]">Trending repositories this week</p>
        </div>

        <div class="mb-6 flex gap-2 text-sm">
          <a
            href="/"
            class="rounded-md bg-[#21262d] px-3 py-1 font-medium text-[#e6edf3]"
          >
            Weekly
          </a>
          <a
            href="/?since=daily"
            class="rounded-md px-3 py-1 text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]"
          >
            Daily
          </a>
          <a
            href="/?since=monthly"
            class="rounded-md px-3 py-1 text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]"
          >
            Monthly
          </a>
        </div>

        <div>
          {repos.map((r, i) => (
            <div class="flex items-start gap-3">
              <span class="mt-7 w-6 shrink-0 text-right text-sm text-[#8b949e]">{i + 1}</span>
              <div class="flex-1">
                <Repo.RepoListItem
                  owner={r.owner.login}
                  repo={r.name}
                  description={r.description}
                  language={r.language}
                  stars={r.stargazers_count}
                  forks={r.forks_count}
                  updated={r.updated_at}
                  topics={r.topics ? [...r.topics] : undefined}
                />
              </div>
            </div>
          ))}
        </div>
      </Layout.Layout>
    )
  }),
)
