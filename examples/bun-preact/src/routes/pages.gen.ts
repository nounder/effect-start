const layout_ = {
  path: "/",
  load: () => import("./_layout.tsx"),
}

const page_ = {
  path: "/",
  layout: layout_,
  load: () => import("./_page.tsx"),
}

const layout_users = {
  path: "/users",
  layout: layout_,
  load: () => import("./users/_layout.tsx"),
}

const page_users_$id = {
  path: "/users/:id",
  layout: layout_users,
  load: () => import("./users/$id/_page.tsx"),
}

const page_about_$ = {
  path: "/about/$",
  layout: layout_,
  load: () => import("./about/$/_page.tsx"),
}

export const Pages = [
  page_,
  page_users_$id,
  page_about_$,
] as const
