import {
  FileSystem,
} from "@effect/platform"
import {
  Link,
  Outlet,
} from "@tanstack/react-router"
import {
  expect,
  it,
  test,
} from "bun:test"
import {
  MemoryFileSystem,
} from "effect-memfs"
import {
  effectFn,
} from "../../../src/testing.ts"
import * as TanstackRouter from "./TanstackRouter.tsx"

const Files = {
  "/routes/layout.tsx": () => {
    return (
      <div>
        <nav>
          <Link to="/">
            Home
          </Link>
          <Link to="/about">
            About
          </Link>
          <Link to="/users">
            Users
          </Link>
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    )
  },
  "/routes/page.tsx": () => {
    return (
      <div>
        <h1>
          Welcome to the Home Page
        </h1>
        <p>
          This is the root route of our TanStack Router application.
        </p>
      </div>
    )
  },
  "/routes/about/page.tsx": () => {
    return (
      <div>
        <h1>
          About Us
        </h1>
        <p>
          This is the about page with information about our application.
        </p>
      </div>
    )
  },

  "/routes/users/page.tsx": () => {
    return (
      <div>
        <h2>
          Users List
        </h2>
        <Outlet />
      </div>
    )
  },
  "/routes/users/[userId]/page.tsx": (
    { params }: { params: { userId: string } },
  ) => {
    const { userId } = params

    return (
      <div>
        <h2>
          User Details
        </h2>
        <p>
          User ID: {userId}
        </p>
        <Link to="/users">
          ← Back to Users
        </Link>
      </div>
    )
  },
}
