import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Route } from "effect-start"
import * as Github from "../../../Github.ts"
import { Layout, Tabs, LanguageBar } from "../../../Ui.tsx"

export default Route.get(
  Route.schemaPathParams(Schema.Struct({ owner: Schema.String, repo: Schema.String })),
  Route.html(function* (ctx) {
    const { owner, repo } = ctx.pathParams
    const path = `${owner}/${repo}`

    const [repoInfo, readme, languages] = yield* Effect.all([
      Github.getRepo(owner, repo),
      Github.getRepoReadme(owner, repo),
      Github.getRepoLanguages(owner, repo),
    ])

    return (
      <Layout>
        <div class="pt-4">
          <div class="flex items-center gap-2 text-xl mb-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#8b949e"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" /></svg>
            <a href={`/${owner}`} class="text-[#58a6ff] hover:underline">{owner}</a>
            <span class="text-[#8b949e]">/</span>
            <a href={`/${path}`} class="text-[#58a6ff] font-bold hover:underline">{repo}</a>
            <span class="text-[#8b949e] border border-[#30363d] rounded-full text-xs px-2 py-0.5 ml-1">{repoInfo.visibility ?? "Public"}</span>
          </div>

          {repoInfo.description && (
            <p class="text-[#8b949e] text-sm mb-4">{repoInfo.description}</p>
          )}

          {repoInfo.topics && repoInfo.topics.length > 0 && (
            <div class="flex flex-wrap gap-1 mb-4">
              {[...repoInfo.topics].map((t) => (
                <a href={`/search?q=topic:${t}`} class="text-[#58a6ff] bg-[#388bfd1a] rounded-full text-xs px-2.5 py-0.5 hover:bg-[#58a6ff] hover:text-white transition-colors">{t}</a>
              ))}
            </div>
          )}

          <div class="flex items-center gap-4 text-sm mb-4 flex-wrap">
            <span class="flex items-center gap-1 text-[#8b949e]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" /></svg>
              <span class="font-semibold text-[#e6edf3]">{Github.num(repoInfo.stargazers_count)}</span> stars
            </span>
            <span class="flex items-center gap-1 text-[#8b949e]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 0-1.5 0v.878H6.75v-.878a2.25 2.25 0 1 0-1.5 0ZM8 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" /></svg>
              <span class="font-semibold text-[#e6edf3]">{Github.num(repoInfo.forks_count)}</span> forks
            </span>
            <span class="flex items-center gap-1 text-[#8b949e]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.824.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z" /></svg>
              <span class="font-semibold text-[#e6edf3]">{Github.num(repoInfo.watchers_count)}</span> watching
            </span>
            {repoInfo.license && (
              <span class="flex items-center gap-1 text-[#8b949e]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8.75.75V2h.985c.304 0 .603.08.867.231l1.29.736c.038.022.08.033.124.033h2.234a.75.75 0 0 1 0 1.5h-.427l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.007.007-.014.012a2.3 2.3 0 0 1-.207.166 2.853 2.853 0 0 1-.63.34c-.264.112-.643.231-1.14.231-.5 0-.877-.12-1.14-.231a2.856 2.856 0 0 1-.63-.34 2.282 2.282 0 0 1-.222-.178l-.014-.013-.007-.006-.002-.003-.001-.001-.531.532.53-.532a.75.75 0 0 1-.154-.838L13.823 5h-.427a.75.75 0 0 1-.124-.033l-1.29-.736A.516.516 0 0 0 11.735 4H8.75v8.5h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5V4H5.515a.516.516 0 0 0-.133.017l-1.29.736A.75.75 0 0 1 3.968 5h-.427L5.653 9.692a.75.75 0 0 1-.154.838l-.531-.532.53.532-.001.002-.002.002-.007.007-.014.012a1.455 1.455 0 0 1-.207.166 2.853 2.853 0 0 1-.63.34c-.264.112-.643.231-1.14.231-.5 0-.877-.12-1.14-.231a2.856 2.856 0 0 1-.63-.34 1.459 1.459 0 0 1-.222-.178l-.014-.013-.007-.006-.002-.003L2 10.53l-.531.533a.75.75 0 0 1-.154-.838L3.427 5H3a.75.75 0 0 1 0-1.5h2.234a.249.249 0 0 0 .124-.033l1.29-.736A1.51 1.51 0 0 1 7.515 2H8.5V.75a.75.75 0 0 1 .25 0Z" /></svg>
                {repoInfo.license.spdx_id ?? repoInfo.license.name}
              </span>
            )}
          </div>

          <Tabs items={[
            { label: "Code", href: `/${path}`, active: true },
            { label: "Issues", href: `/${path}/issues`, count: repoInfo.open_issues_count },
            { label: "Pull requests", href: `/${path}/pulls` },
            { label: "Commits", href: `/${path}/commits` },
            { label: "Contributors", href: `/${path}/contributors` },
          ]} />

          <div class="flex flex-col lg:flex-row gap-8">
            <div class="flex-1 min-w-0">
              {readme && (
                <div class="border border-[#21262d] rounded-md">
                  <div class="px-4 py-3 border-b border-[#21262d] bg-[#161b22] rounded-t-md">
                    <span class="text-sm font-semibold">README.md</span>
                  </div>
                  <div class="p-6 markdown-body" dangerouslySetInnerHTML={{ __html: readme }} />
                </div>
              )}
            </div>

            <aside class="lg:w-[296px] shrink-0">
              {repoInfo.description && (
                <div class="mb-4 pb-4 border-b border-[#21262d]">
                  <h3 class="text-sm font-semibold mb-2">About</h3>
                  <p class="text-sm text-[#8b949e]">{repoInfo.description}</p>
                  {repoInfo.homepage && (
                    <a href={repoInfo.homepage} class="text-sm text-[#58a6ff] hover:underline flex items-center gap-1 mt-2">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z" /></svg>
                      {repoInfo.homepage}
                    </a>
                  )}
                </div>
              )}

              {repoInfo.topics && repoInfo.topics.length > 0 && (
                <div class="mb-4 pb-4 border-b border-[#21262d]">
                  <h3 class="text-sm font-semibold mb-2">Topics</h3>
                  <div class="flex flex-wrap gap-1">
                    {[...repoInfo.topics].map((t) => (
                      <a href={`/search?q=topic:${t}`} class="text-[#58a6ff] bg-[#388bfd1a] rounded-full text-xs px-2.5 py-0.5 hover:bg-[#58a6ff] hover:text-white transition-colors">{t}</a>
                    ))}
                  </div>
                </div>
              )}

              {languages && Object.keys(languages).length > 0 && (
                <div class="mb-4 pb-4 border-b border-[#21262d]">
                  <h3 class="text-sm font-semibold mb-3">Languages</h3>
                  <LanguageBar languages={languages} />
                </div>
              )}

              <div class="text-sm text-[#8b949e] space-y-2">
                {repoInfo.has_issues && (
                  <a href={`/${path}/issues`} class="flex items-center gap-2 hover:text-[#58a6ff]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" /></svg>
                    {Github.num(repoInfo.open_issues_count)} issues
                  </a>
                )}
              </div>
            </aside>
          </div>
        </div>
      </Layout>
    )
  }),
)
