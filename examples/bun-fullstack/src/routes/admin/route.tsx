import { Effect } from "effect"
import { Route } from "effect-start"

const users = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "Admin" },
  { id: 2, name: "Bob Smith", email: "bob@example.com", role: "User" },
  { id: 3, name: "Charlie Brown", email: "charlie@example.com", role: "User" },
  {
    id: 4,
    name: "Diana Prince",
    email: "diana@example.com",
    role: "Moderator",
  },
  { id: 5, name: "Eve Wilson", email: "eve@example.com", role: "User" },
]

export default Route.html(
  Effect.gen(function*() {
    return (
      <div>
        <h3>
          User Management
        </h3>
        <p>
          Total users: {users.length}
        </p>
        <table border="1" cellpadding="8" cellspacing="0">
          <thead>
            <tr>
              <th>
                ID
              </th>
              <th>
                Name
              </th>
              <th>
                Email
              </th>
              <th>
                Role
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.id}
                </td>
                <td>
                  {user.name}
                </td>
                <td>
                  {user.email}
                </td>
                <td>
                  {user.role}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }),
)
