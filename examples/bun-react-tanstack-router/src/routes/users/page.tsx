import { Outlet } from "@tanstack/react-router"
import React from "react"

export default function UsersLayout() {
  return (
    <div>
      <h1>
        Users Section
      </h1>
      <Outlet />
    </div>
  )
}
