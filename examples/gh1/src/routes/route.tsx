import { Route } from "effect-start"
import * as Github from "../Github.ts"
import { Layout, RepoListItem } from "../Ui.tsx"

export default Route.get(
  Route.html(function* () {
    const trending = yield* Github.getTrending({ since: "weekly" })
    const repos = trending.items

    return (
      <Layout>
        <div class="mb-8 pt-8 pb-4">
          <h1 class="text-3xl font-bold mb-1">Explore</h1>
          <p class="text-[#8b949e] text-base">Trending repositories this week</p>
        </div>

        <div class="flex gap-2 mb-6 text-sm">
          <a href="/" class="px-3 py-1 rounded-md bg-[#21262d] text-[#e6edf3] font-medium">Weekly</a>
          <a href="/?since=daily" class="px-3 py-1 rounded-md text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]">Daily</a>
          <a href="/?since=monthly" class="px-3 py-1 rounded-md text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]">Monthly</a>
        </div>

        <div>
          {repos.map((r, i) => (
            <div class="flex items-start gap-3">
              <span class="text-[#8b949e] text-sm mt-7 w-6 text-right shrink-0">{i + 1}</span>
              <div class="flex-1">
                <RepoListItem
                  fullName={r.full_name}
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
      </Layout>
    )
  }),
)
