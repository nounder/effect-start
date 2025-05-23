import { Link } from "@tanstack/react-router"
import React from "react"

interface UserDetailPageProps {
  params: { userId: string }
}

export default function UserDetailPage({ params }: UserDetailPageProps) {
  const { userId } = params

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
        <h2>User Not Found</h2>
        <p>No user found with ID: {userId}</p>
        <Link to="/users">← Back to Users</Link>
      </div>
    )
  }

  return (
    <div>
      <h2>User Details</h2>
      <div
        style={{
          border: "1px solid #ccc",
          padding: "1rem",
          borderRadius: "4px",
        }}
      >
        <h3>{user.name}</h3>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>Bio:</strong> {user.bio}
        </p>
        <p>
          <strong>User ID:</strong> {user.id}
        </p>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <Link to="/users">← Back to Users List</Link>
      </div>
    </div>
  )
}
