import { Route } from "effect-start"
import * as Effect from "effect/Effect"

export default Route.json(
  Effect.succeed({
    stats: {
      totalUsers: 5,
      activeUsers: 3,
      inactiveUsers: 2,
    },
    recentActivity: [
      {
        id: 1,
        action: "User login",
        user: "Alice Johnson",
        timestamp: "2025-11-27T10:30:00Z",
      },
      {
        id: 2,
        action: "Profile updated",
        user: "Bob Smith",
        timestamp: "2025-11-27T10:15:00Z",
      },
      {
        id: 3,
        action: "Password changed",
        user: "Diana Prince",
        timestamp: "2025-11-27T09:45:00Z",
      },
    ],
    systemInfo: {
      version: "1.0.0",
      uptime: "24 days",
      environment: "production",
    },
  }),
)
