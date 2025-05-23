import {
  Link,
  Outlet,
} from "@tanstack/react-router"
import React from "react"

export default function() {
  return (
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
  )
}
