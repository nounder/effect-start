type Param = string | number | bigint

// 2) Build a template-literal path type from your `segs`
type SegPath<S extends readonly unknown[]> = S extends readonly [] ? ""
  : S extends readonly [infer H, ...infer T] ? `${H extends string ? `/${H}`
      : H extends { param: string } ? `/${Param}`
      : never}${SegPath<T>}`
  : never

const LayerModules = {
  "/": {
    path: [],
    load: () => import("./layer.tsx"),
  },
  "/(admin)": {
    path: [{ group: "admin" }],
    load: () => import("./(admin)/layer.ts"),
    parent: () => LayerModules["/"],
  },
  "/(admin)/users": {
    path: [{ group: "admin" }, "users"],
    load: () => import("./(admin)/layer.ts"),
    parent: () => LayerModules["/(admin)"],
  },
  "/movies": {
    path: ["movies"],
    load: () => import("./movies/layer.tsx"),
    parent: () => LayerModules["/"],
  },
  "/movies/[id]": {
    path: ["movies", { param: "id" }],
    load: () => import("./movies/layer.tsx"),
    parent: () => LayerModules["/movies/$id"],
  },
} as const

const RouteModules = {
  "/movies": {
    segs: ["movies"],
    load: () => import("./movies/route.tsx"),
    layer: () => LayerModules["/movies"],
  },
  "/movies/[id]": {
    segs: ["movies", { param: "id" }],
    load: () => import("./movies/[id]/route.tsx"),
    layer: () => LayerModules["/movies/[id]"],
  },
  "/users": {
    segs: ["users"],
    load: () => import("./movies/[id]/route.tsx"),
    layer: () => LayerModules["/(admin)/users"],
  },
} as const

const ClientModules = {
  "/admin": {
    segs: ["admin"],
    url: import.meta.resolve("./admin)/client.ts"),
  },
}

type RouteSegments =
  | ["movies"]
  | ["movies", id: Param]
  | ["users"]

type RouteUrl =
  | `/movies`
  | `/movies/${Param}`
  | `/users`

interface TemplateStringsArray extends ReadonlyArray<string> {
  readonly raw: readonly string[]
}

function routeUrl(template: TemplateStringsArray, ...values: Param[]): string
function routeUrl(url: RouteUrl): string
function routeUrl(...args: RouteSegments): string
function routeUrl(
  templateOrUrl: TemplateStringsArray | RouteUrl | string,
  ...rest: (Param | string | number | bigint)[]
): string {
  if (
    Array.isArray(templateOrUrl)
    && "raw" in templateOrUrl
  ) {
    // Tagged template literal
    let result = templateOrUrl[0]
    for (let i = 0; i < rest.length; i++) {
      result += String(rest[i]) + templateOrUrl[i + 1]
    }
    return result
  }

  if (typeof templateOrUrl === "string" && rest.length === 0) {
    return templateOrUrl
  }

  return "/" + [templateOrUrl, ...rest].join("/")
}

routeUrl("movies", 23)
routeUrl("users")

routeUrl`/movies`
