import React from 'react'
import { Outlet } from '@tanstack/react-router'

export default function UsersLayout() {
  return (
    <div>
      <h1>Users Section</h1>
      <Outlet />
    </div>
  )
} 