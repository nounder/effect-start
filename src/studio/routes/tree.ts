import * as Route from "../../Route.ts"
import errorsRoute from "./errors/route.tsx"
import fiberDetailRoute from "./fiberDetail.tsx"
import fibersRoute from "./fibers/route.tsx"
import layout from "./layout.tsx"
import logsRoute from "./logs/route.tsx"
import metricsRoute from "./metrics/route.tsx"
import systemRoute from "./system/route.tsx"
import rootRoute from "./route.tsx"
import routesRoute from "./routes/route.tsx"
import servicesRoute from "./services/route.tsx"
import traceDetailRoute from "./traceDetail.tsx"
import tracesRoute from "./traces/route.tsx"

export default Route.tree({
  "*": layout,
  "/": rootRoute,
  "/traces": tracesRoute,
  "/traces/:id": traceDetailRoute,
  "/metrics": metricsRoute,
  "/logs": logsRoute,
  "/errors": errorsRoute,
  "/fibers": fibersRoute,
  "/fibers/:id": fiberDetailRoute,
  "/routes": routesRoute,
  "/system": systemRoute,
  "/services": servicesRoute,
})
