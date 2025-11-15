import type * as Router from "effect-start/Router"

// type it as Router.RouteModules
export const Modules = [
  {
    path: "/",
    segments: [],
    load: () => import("./route.ts"),
  },
  {
    path: "/(admin)/users",
    segments: [
      { group: "admin" },
      { literal: "users" },
    ],
    load: () => import("./(admin)/users/route.tsx"),
    layers: [
      () => import("./(admin)/layer.ts"),
    ],
  },
  {
    path: "/movies",
    segments: [
      { literal: "movies" },
    ],
    load: () => import("./movies/route.tsx"),
    layers: [
      () => import("./movies/layer.tsx"),
    ],
  },
  {
    path: "/movies/[id]",
    segments: [
      { literal: "movies" },
      { param: "id" },
    ],
    load: () => import("./movies/[id]/route.tsx"),
    layers: [
      () => import("./movies/layer.tsx"),
    ],
  },
  {
    path: "/about/[[...section]]",
    segments: [
      { literal: "about" },
      { rest: "section", optional: true },
    ],
    load: () => import("./about/[[...section]]/route.tsx"),
    layers: [
      () => import("./about/[[...section]]/layer.tsx"),
    ],
  },
] as const
