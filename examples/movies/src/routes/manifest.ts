const layout_ = {
  path: "/",
  parent: undefined,
  load: () => import("./_layout.tsx"),
}

const page_ = {
  path: "/",
  parent: layout_,
  load: () => import("./manifest-new.tsx"),
}

const layout_about = {
  path: "/about",
  parent: layout_,
  load: () => import("./about/layer.tsx"),
}

const page_about = {
  path: "/about",
  parent: layout_about,
  load: () => import("./about/route.tsx"),
}

const layout_users = {
  path: "/users",
  parent: layout_,
  load: () => import("./movies/layer.tsx"),
}

const page_users = {
  path: "/users",
  parent: layout_users,
  load: () => import("./movies/route.tsx"),
}

const page_users_$id = {
  path: "/users/$id",
  parent: layout_users,
  load: () => import("./movies/[id]/route.tsx"),
}

export const Pages = [
  page_,
  page_about,
  page_users,
  page_users_$id,
] as const
