import {
  describe,
  expect,
  test,
} from "bun:test"
import {
  FileRouter,
} from "effect-bundler"

const Paths = [
  "about/_layout.tsx",
  "about/_page.tsx",
  "users/_page.tsx",
  "users/_layout.tsx",
  "users/$userId/_page.tsx",
  "_layout.tsx",
]
