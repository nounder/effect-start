const layout_ = {
  path: "/",
  parent: undefined,
  load: () => import("./_layout.tsx"),
}

const page_ = {
  path: "/",
  parent: layout_,
  load: () => import("./_page.tsx"),
}

const layout_about = {
  path: "/about",
  parent: layout_,
  load: () => import("./about/_layout.tsx"),
}

const page_about = {
  path: "/about",
  parent: layout_about,
  load: () => import("./about/_page.tsx"),
}

const layout_users = {
  path: "/users",
  parent: layout_,
  load: () => import("./users/_layout.tsx"),
}

const page_users = {
  path: "/users",
  parent: layout_users,
  load: () => import("./users/_page.tsx"),
}

const page_users_$id = {
  path: "/users/$id",
  parent: layout_users,
  load: () => import("./users/$id/_page.tsx"),
}

const page_about_$ = {
  path: "/about/$",
  parent: layout_about,
  load: () => import("./about/$/_page.tsx"),
}

export const Pages = [
  page_,
  page_about,
  page_users,
  page_users_$id,
  page_about_$
] as const
 