export type NavTab =
  | "traces"
  | "metrics"
  | "logs"
  | "errors"
  | "fibers"
  | "routes"
  | "system"
  | "services"

export function Sidebar(options: { prefix: string; active: NavTab }) {
  return (
    <div class="sidebar">
      <div class="sidebar-title">Effect Tower</div>
      <a
        href={`${options.prefix}/traces`}
        class={options.active === "traces" ? "nav-link active" : "nav-link"}
      >
        Traces
      </a>
      <a
        href={`${options.prefix}/metrics`}
        class={options.active === "metrics" ? "nav-link active" : "nav-link"}
      >
        Metrics
      </a>
      <a
        href={`${options.prefix}/logs`}
        class={options.active === "logs" ? "nav-link active" : "nav-link"}
      >
        Logs
      </a>
      <a
        href={`${options.prefix}/errors`}
        class={options.active === "errors" ? "nav-link active" : "nav-link"}
      >
        Errors
      </a>
      <a
        href={`${options.prefix}/fibers`}
        class={options.active === "fibers" ? "nav-link active" : "nav-link"}
      >
        Fibers
      </a>
      <a
        href={`${options.prefix}/routes`}
        class={options.active === "routes" ? "nav-link active" : "nav-link"}
      >
        Routes
      </a>
      <a
        href={`${options.prefix}/system`}
        class={options.active === "system" ? "nav-link active" : "nav-link"}
      >
        System
      </a>
      <a
        href={`${options.prefix}/services`}
        class={options.active === "services" ? "nav-link active" : "nav-link"}
      >
        Services
      </a>
    </div>
  )
}

export function Shell(options: { prefix: string; active: NavTab; children: any }) {
  return (
    <div class="shell">
      <Sidebar prefix={options.prefix} active={options.active} />
      <div class="content">{options.children}</div>
    </div>
  )
}
