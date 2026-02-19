export interface RouteInfo {
  readonly method: string
  readonly path: string
  readonly format: string | undefined
}

function groupByPath(routes: Array<RouteInfo>): Array<{ path: string; routes: Array<RouteInfo> }> {
  const byPath = new Map<string, Array<RouteInfo>>()
  for (const r of routes) {
    let group = byPath.get(r.path)
    if (!group) {
      group = []
      byPath.set(r.path, group)
    }
    group.push(r)
  }
  return Array.from(byPath, ([path, routes]) => ({
    path,
    routes: routes.sort((a, b) => methodOrder.indexOf(a.method) - methodOrder.indexOf(b.method)),
  })).sort((a, b) => a.path.localeCompare(b.path))
}

function methodColor(method: string): string {
  if (method === "GET") return "#22c55e"
  if (method === "POST") return "#3b82f6"
  if (method === "PUT") return "#f59e0b"
  if (method === "DELETE") return "#ef4444"
  if (method === "PATCH") return "#a855f7"
  if (method === "*") return "#6b7280"
  return "#94a3b8"
}

function methodBg(method: string): string {
  if (method === "GET") return "#052e16"
  if (method === "POST") return "#172554"
  if (method === "PUT") return "#422006"
  if (method === "DELETE") return "#450a0a"
  if (method === "PATCH") return "#3b0764"
  return "#1e293b"
}

const methodOrder = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "*"]

function MethodBadge(options: { method: string }) {
  return (
    <span
      style={`font-size:10px;font-weight:700;font-family:monospace;padding:2px 6px;border-radius:3px;background:${methodBg(options.method)};color:${methodColor(options.method)};min-width:48px;text-align:center;display:inline-block`}
    >
      {options.method}
    </span>
  )
}

function FormatBadge(options: { format: string }) {
  return (
    <span style="font-size:10px;padding:1px 6px;border-radius:3px;background:#1e3a5f;color:#60a5fa">
      {options.format}
    </span>
  )
}

function ColoredPath(options: { path: string }) {
  const segments = options.path.split("/").filter(Boolean)
  return (
    <span style="font-family:monospace;font-size:13px">
      {segments.length === 0 ? (
        <span style="color:#e2e8f0">/</span>
      ) : (
        segments.map((seg) => {
          const isParam = seg.startsWith(":")
          return (
            <>
              <span style="color:#475569">/</span>
              <span style={isParam ? "color:#c084fc" : "color:#e2e8f0"}>{seg}</span>
            </>
          )
        })
      )}
    </span>
  )
}

function PathGroup(options: { path: string; routes: Array<RouteInfo> }) {
  return (
    <div style="padding:8px 12px;border-bottom:1px solid #1e293b">
      <div style="margin-bottom:4px">
        <ColoredPath path={options.path} />
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        {options.routes.map((r) => (
          <div style="display:flex;align-items:center;gap:6px">
            <MethodBadge method={r.method} />
            {r.format && <FormatBadge format={r.format} />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function RouteList(options: { routes: Array<RouteInfo> }) {
  if (options.routes.length === 0) {
    return <div class="empty">No routes registered</div>
  }

  const groups = groupByPath(options.routes)
  const routeCount = options.routes.length
  const pathCount = groups.length

  return (
    <>
      <div style="padding:8px 12px;border-bottom:1px solid #1e293b;display:flex;gap:16px;font-size:12px;color:#64748b">
        <span>
          {pathCount} path{pathCount !== 1 ? "s" : ""}
        </span>
        <span>
          {routeCount} route{routeCount !== 1 ? "s" : ""}
        </span>
      </div>
      {groups.map((g) => (
        <PathGroup path={g.path} routes={g.routes} />
      ))}
    </>
  )
}
