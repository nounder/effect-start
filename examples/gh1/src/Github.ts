import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Fetch from "effect-start/Fetch"

const API = "https://api.github.com"

const client = Fetch.use((request, next) =>
  Effect.gen(function* () {
    const token = yield* Config.string("GITHUB_TOKEN")
    const accept = request.headers.get("Accept") ?? "application/vnd.github+json"
    return yield* next(new Request(request, {
      headers: {
        Accept: accept,
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
    }))
  }),
).use(Fetch.filterStatusOk())

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${API}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

function request<A, I>(schema: Schema.Schema<A, I>, path: string, params?: Record<string, string | number | undefined>) {
  const url = buildUrl(path, params)
  return Effect.flatMap(
    Effect.flatMap(client.get(url), (entity) => entity.json),
    Schema.decodeUnknown(schema),
  )
}

function requestHtml(path: string) {
  const url = buildUrl(path)
  return Effect.catchAll(
    Effect.flatMap(
      client.get(url, { headers: { Accept: "application/vnd.github.html+json" } }),
      (entity) => entity.text,
    ),
    () => Effect.succeed(""),
  )
}

const GithubOwner = Schema.Struct({
  login: Schema.String,
  avatar_url: Schema.String,
  html_url: Schema.String,
  type: Schema.optional(Schema.String),
})

const Label = Schema.Struct({
  name: Schema.String,
  color: Schema.String,
  description: Schema.NullOr(Schema.String),
})

const License = Schema.Struct({
  name: Schema.String,
  spdx_id: Schema.NullOr(Schema.String),
})

const User = Schema.Struct({
  login: Schema.String,
  id: Schema.Number,
  avatar_url: Schema.String,
  html_url: Schema.String,
  name: Schema.NullOr(Schema.String),
  company: Schema.NullOr(Schema.String),
  blog: Schema.optional(Schema.NullOr(Schema.String)),
  location: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  bio: Schema.NullOr(Schema.String),
  twitter_username: Schema.NullOr(Schema.String),
  public_repos: Schema.Number,
  public_gists: Schema.Number,
  followers: Schema.Number,
  following: Schema.Number,
  created_at: Schema.String,
  updated_at: Schema.String,
  type: Schema.String,
})
export type User = typeof User.Type

const Repo = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  full_name: Schema.String,
  description: Schema.NullOr(Schema.String),
  html_url: Schema.String,
  owner: GithubOwner,
  private: Schema.Boolean,
  fork: Schema.Boolean,
  language: Schema.NullOr(Schema.String),
  stargazers_count: Schema.Number,
  forks_count: Schema.Number,
  watchers_count: Schema.Number,
  open_issues_count: Schema.Number,
  topics: Schema.optional(Schema.Array(Schema.String)),
  default_branch: Schema.optional(Schema.String),
  created_at: Schema.NullOr(Schema.String),
  updated_at: Schema.NullOr(Schema.String),
  pushed_at: Schema.NullOr(Schema.String),
  visibility: Schema.optional(Schema.String),
  has_issues: Schema.optional(Schema.Boolean),
  has_wiki: Schema.optional(Schema.Boolean),
  has_pages: Schema.optional(Schema.Boolean),
  license: Schema.optional(Schema.NullOr(License)),
  homepage: Schema.optional(Schema.NullOr(Schema.String)),
  archived: Schema.optional(Schema.Boolean),
})
export type Repo = typeof Repo.Type

const Issue = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  state: Schema.String,
  state_reason: Schema.optional(Schema.NullOr(Schema.String)),
  body: Schema.NullOr(Schema.String),
  html_url: Schema.String,
  user: Schema.NullOr(GithubOwner),
  labels: Schema.Array(Label),
  comments: Schema.Number,
  pull_request: Schema.optional(Schema.Unknown),
  created_at: Schema.String,
  updated_at: Schema.String,
  closed_at: Schema.NullOr(Schema.String),
})
export type Issue = typeof Issue.Type

const PullRequest = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  state: Schema.String,
  draft: Schema.optional(Schema.Boolean),
  body: Schema.NullOr(Schema.String),
  html_url: Schema.String,
  user: Schema.NullOr(GithubOwner),
  labels: Schema.Array(Label),
  merged_at: Schema.NullOr(Schema.String),
  comments: Schema.optional(Schema.Number),
  review_comments: Schema.optional(Schema.Number),
  commits: Schema.optional(Schema.Number),
  additions: Schema.optional(Schema.Number),
  deletions: Schema.optional(Schema.Number),
  changed_files: Schema.optional(Schema.Number),
  created_at: Schema.String,
  updated_at: Schema.String,
  closed_at: Schema.NullOr(Schema.String),
  base: Schema.optional(Schema.Struct({ label: Schema.optional(Schema.String) })),
  head: Schema.optional(Schema.Struct({ label: Schema.optional(Schema.String) })),
})
export type PullRequest = typeof PullRequest.Type

const CommitAuthor = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  date: Schema.String,
})

const Commit = Schema.Struct({
  sha: Schema.String,
  commit: Schema.Struct({
    message: Schema.String,
    author: CommitAuthor,
    committer: CommitAuthor,
  }),
  author: Schema.NullOr(GithubOwner),
  committer: Schema.NullOr(GithubOwner),
  html_url: Schema.String,
  parents: Schema.Array(Schema.Struct({ sha: Schema.String })),
  stats: Schema.optional(Schema.Struct({
    additions: Schema.Number,
    deletions: Schema.Number,
    total: Schema.Number,
  })),
  files: Schema.optional(Schema.Array(Schema.Struct({
    filename: Schema.String,
    status: Schema.String,
    additions: Schema.Number,
    deletions: Schema.Number,
    patch: Schema.optional(Schema.String),
  }))),
})
export type Commit = typeof Commit.Type

const IssueComment = Schema.Struct({
  id: Schema.Number,
  body: Schema.NullOr(Schema.String),
  user: Schema.NullOr(GithubOwner),
  created_at: Schema.String,
  updated_at: Schema.String,
})
export type IssueComment = typeof IssueComment.Type

const Contributor = Schema.Struct({
  login: Schema.String,
  avatar_url: Schema.String,
  html_url: Schema.String,
  contributions: Schema.Number,
  type: Schema.optional(Schema.String),
})
export type Contributor = typeof Contributor.Type

const SearchResult = <A, I>(itemSchema: Schema.Schema<A, I>) =>
  Schema.Struct({
    total_count: Schema.Number,
    incomplete_results: Schema.Boolean,
    items: Schema.Array(itemSchema),
  })

const SearchUser = Schema.Struct({
  login: Schema.String,
  id: Schema.Number,
  avatar_url: Schema.String,
  html_url: Schema.String,
  type: Schema.optional(Schema.String),
})

const Org = Schema.Struct({
  login: Schema.String,
  id: Schema.Number,
  avatar_url: Schema.String,
  html_url: Schema.String,
  name: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  blog: Schema.optional(Schema.NullOr(Schema.String)),
  location: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  public_repos: Schema.Number,
  followers: Schema.optional(Schema.Number),
  following: Schema.optional(Schema.Number),
  created_at: Schema.String,
  updated_at: Schema.String,
  type: Schema.optional(Schema.String),
})
export type Org = typeof Org.Type

const OrgMember = Schema.Struct({
  login: Schema.String,
  avatar_url: Schema.String,
  html_url: Schema.String,
  type: Schema.optional(Schema.String),
})

const Languages = Schema.Record({ key: Schema.String, value: Schema.Number })

export const getUser = (username: string) =>
  request(User, `/users/${username}`)

export const getUserRepos = (username: string, opts?: { sort?: string; per_page?: number; page?: number }) =>
  request(Schema.Array(Repo), `/users/${username}/repos`, {
    sort: opts?.sort ?? "updated",
    per_page: opts?.per_page ?? 30,
    page: opts?.page,
    type: "owner",
  })

export const getRepo = (owner: string, repo: string) =>
  request(Repo, `/repos/${owner}/${repo}`)

export const getRepoIssues = (owner: string, repo: string, opts?: { state?: string; per_page?: number; page?: number }) =>
  request(Schema.Array(Issue), `/repos/${owner}/${repo}/issues`, {
    state: opts?.state ?? "open",
    per_page: opts?.per_page ?? 30,
    page: opts?.page,
  })

export const getRepoPulls = (owner: string, repo: string, opts?: { state?: string; per_page?: number; page?: number }) =>
  request(Schema.Array(PullRequest), `/repos/${owner}/${repo}/pulls`, {
    state: opts?.state ?? "open",
    per_page: opts?.per_page ?? 30,
    page: opts?.page,
  })

export const getRepoCommits = (owner: string, repo: string, opts?: { per_page?: number; page?: number; sha?: string }) =>
  request(Schema.Array(Commit), `/repos/${owner}/${repo}/commits`, {
    per_page: opts?.per_page ?? 30,
    page: opts?.page,
    sha: opts?.sha,
  })

export const getRepoContributors = (owner: string, repo: string, opts?: { per_page?: number; page?: number }) =>
  request(Schema.Array(Contributor), `/repos/${owner}/${repo}/contributors`, {
    per_page: opts?.per_page ?? 100,
    page: opts?.page,
  })

export const getIssue = (owner: string, repo: string, number: number) =>
  request(Issue, `/repos/${owner}/${repo}/issues/${number}`)

export const getIssueComments = (owner: string, repo: string, number: number, opts?: { per_page?: number }) =>
  request(Schema.Array(IssueComment), `/repos/${owner}/${repo}/issues/${number}/comments`, { per_page: opts?.per_page ?? 50 })

export const getPull = (owner: string, repo: string, number: number) =>
  request(PullRequest, `/repos/${owner}/${repo}/pulls/${number}`)

export const getCommit = (owner: string, repo: string, sha: string) =>
  request(Commit, `/repos/${owner}/${repo}/commits/${sha}`)

export const getRepoReadme = (owner: string, repo: string) =>
  requestHtml(`/repos/${owner}/${repo}/readme`)

export const getRepoLanguages = (owner: string, repo: string) =>
  request(Languages, `/repos/${owner}/${repo}/languages`)

export const searchRepos = (q: string, opts?: { sort?: string; order?: string; per_page?: number; page?: number }) =>
  request(SearchResult(Repo), "/search/repositories", {
    q,
    sort: opts?.sort ?? "stars",
    order: opts?.order ?? "desc",
    per_page: opts?.per_page ?? 30,
    page: opts?.page,
  })

export const searchUsers = (q: string, opts?: { sort?: string; per_page?: number; page?: number }) =>
  request(SearchResult(SearchUser), "/search/users", {
    q,
    sort: opts?.sort,
    per_page: opts?.per_page ?? 30,
    page: opts?.page,
  })

export const getOrg = (org: string) =>
  request(Org, `/orgs/${org}`)

export const getOrgRepos = (org: string, opts?: { sort?: string; per_page?: number; page?: number }) =>
  request(Schema.Array(Repo), `/orgs/${org}/repos`, {
    sort: opts?.sort ?? "updated",
    per_page: opts?.per_page ?? 30,
    page: opts?.page,
    type: "public",
  })

export const getOrgMembers = (org: string, opts?: { per_page?: number; page?: number }) =>
  request(Schema.Array(OrgMember), `/orgs/${org}/members`, {
    per_page: opts?.per_page ?? 100,
    page: opts?.page,
  })

export const getUserStarred = (username: string, opts?: { per_page?: number; page?: number; sort?: string }) =>
  request(Schema.Array(Repo), `/users/${username}/starred`, {
    per_page: opts?.per_page ?? 30,
    page: opts?.page,
    sort: opts?.sort ?? "created",
  })

export const getRepoReleases = (owner: string, repo: string, opts?: { per_page?: number; page?: number }) =>
  request(Schema.Array(Schema.Struct({
    id: Schema.Number,
    tag_name: Schema.String,
    name: Schema.NullOr(Schema.String),
    body: Schema.NullOr(Schema.String),
    draft: Schema.Boolean,
    prerelease: Schema.Boolean,
    created_at: Schema.String,
    published_at: Schema.NullOr(Schema.String),
    author: GithubOwner,
  })), `/repos/${owner}/${repo}/releases`, {
    per_page: opts?.per_page ?? 10,
    page: opts?.page,
  })

export const getTrending = (opts?: { language?: string; since?: string }) => {
  const days = opts?.since === "monthly" ? 30 : opts?.since === "weekly" ? 7 : 1
  const date = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  let q = `created:>${date}`
  if (opts?.language) q += ` language:${opts.language}`
  return searchRepos(q, { sort: "stars", per_page: 25 })
}

export function num(n: string | number | undefined | null): string {
  if (n === undefined || n === null) return "0"
  const v = typeof n === "string" ? parseInt(n, 10) : n
  if (v >= 1000000) return (v / 1000000).toFixed(1) + "M"
  if (v >= 1000) return (v / 1000).toFixed(1) + "k"
  return String(v)
}

export function timeAgo(date: string | undefined | null): string {
  if (!date) return ""
  const now = Date.now()
  const then = new Date(date).getTime()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function langColor(lang: string): string {
  const colors: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Rust: "#dea584",
    Go: "#00ADD8",
    Java: "#b07219",
    "C++": "#f34b7d",
    C: "#555555",
    Ruby: "#701516",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Dart: "#00B4AB",
    PHP: "#4F5D95",
    Shell: "#89e051",
    Lua: "#000080",
    Zig: "#ec915c",
    Elixir: "#6e4a7e",
    Haskell: "#5e5086",
    Scala: "#c22d40",
    "C#": "#178600",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Vue: "#41b883",
    Svelte: "#ff3e00",
    Nix: "#7e7eff",
  }
  return colors[lang] ?? "#8b949e"
}
