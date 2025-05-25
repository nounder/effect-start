import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
} from "@tanstack/react-router"
import React from "react"

// Root route
const rootRoute = createRootRoute({
  component: () => (
    <div>
      <nav style={{ padding: "1rem", borderBottom: "1px solid #ccc" }}>
        <Link to="/" style={{ marginRight: "1rem" }}>
          Home
        </Link>
        <Link to="/about" style={{ marginRight: "1rem" }}>
          About
        </Link>
        <Link to="/users" style={{ marginRight: "1rem" }}>
          Users
        </Link>
      </nav>
      <main style={{ padding: "1rem" }}>
        <Outlet />
      </main>
    </div>
  ),
})

// Index route (/)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <div>
      <h1>
        Welcome to the Home Page
      </h1>
      <p>
        This is the root route of our TanStack Router application.
      </p>
    </div>
  ),
})

// About route
const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: () => (
    <div>
      <h1>
        About Us
      </h1>
      <p>
        This is the about page with information about our application.
      </p>
    </div>
  ),
})

// Users layout route
const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users",
  component: () => (
    <div>
      <h1>
        Users Section
      </h1>
      <Outlet />
    </div>
  ),
})

// Users list route (users/)
const usersIndexRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: "/",
  component: () => {
    const users = [
      { id: "1", name: "John Doe", email: "john@example.com" },
      { id: "2", name: "Jane Smith", email: "jane@example.com" },
      { id: "3", name: "Bob Johnson", email: "bob@example.com" },
    ]

    return (
      <div>
        <h2>
          Users List
        </h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {users.map((user) => (
            <div
              key={user.id}
              style={{
                border: "1px solid #ccc",
                padding: "1rem",
                borderRadius: "4px",
              }}
            >
              <h3>
                <Link
                  to="/users/$userId"
                  params={{ userId: user.id }}
                  style={{ textDecoration: "none" }}
                >
                  {user.name}
                </Link>
              </h3>
              <p>
                {user.email}
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  },
})

// User detail route (users/$userId)
const userRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: "/$userId",
  component: () => {
    const { userId } = userRoute.useParams()

    // Mock user data - in a real app, you'd fetch this from an API
    const users: Record<
      string,
      { id: string; name: string; email: string; bio: string }
    > = {
      "1": {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        bio: "Software developer with 5 years of experience.",
      },
      "2": {
        id: "2",
        name: "Jane Smith",
        email: "jane@example.com",
        bio: "UX designer passionate about user-centered design.",
      },
      "3": {
        id: "3",
        name: "Bob Johnson",
        email: "bob@example.com",
        bio: "Product manager focused on agile methodologies.",
      },
    }

    const user = users[userId]

    if (!user) {
      return (
        <div>
          <h2>
            User Not Found
          </h2>
          <p>
            No user found with ID: {userId}
          </p>
          <Link to="/users">
            ← Back to Users
          </Link>
        </div>
      )
    }

    return (
      <div>
        <h2>
          User Details
        </h2>
        <div
          style={{
            border: "1px solid #ccc",
            padding: "1rem",
            borderRadius: "4px",
          }}
        >
          <h3>
            {user.name}
          </h3>
          <p>
            <strong>
              Email:
            </strong>{" "}
            {user.email}
          </p>
          <p>
            <strong>
              Bio:
            </strong>{" "}
            {user.bio}
          </p>
          <p>
            <strong>
              User ID:
            </strong>{" "}
            {user.id}
          </p>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <Link to="/users">
            ← Back to Users List
          </Link>
        </div>
      </div>
    )
  },
})

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  usersRoute.addChildren([
    usersIndexRoute,
    userRoute,
  ]),
])

// Create hash history
const hashHistory = createHashHistory()

// Create the router with hash history
export const router = createRouter({
  routeTree,
  history: hashHistory,
})
