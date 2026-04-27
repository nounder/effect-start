export type NavTab =
  | "traces"
  | "metrics"
  | "logs"
  | "errors"
  | "fibers"
  | "routes"
  | "system"
  | "services"

export function Sidebar(props: { prefix: string; active: NavTab }) {
  return (
    <div class="sidebar">
      <div class="sidebar-title">Effect Studio</div>
      <a
        href={`${props.prefix}/traces`}
        class={props.active === "traces" ? "nav-link active" : "nav-link"}
      >
        Traces
      </a>
      <a
        href={`${props.prefix}/metrics`}
        class={props.active === "metrics" ? "nav-link active" : "nav-link"}
      >
        Metrics
      </a>
      <a
        href={`${props.prefix}/logs`}
        class={props.active === "logs" ? "nav-link active" : "nav-link"}
      >
        Logs
      </a>
      <a
        href={`${props.prefix}/errors`}
        class={props.active === "errors" ? "nav-link active" : "nav-link"}
      >
        Errors
      </a>
      <a
        href={`${props.prefix}/fibers`}
        class={props.active === "fibers" ? "nav-link active" : "nav-link"}
      >
        Fibers
      </a>
      <a
        href={`${props.prefix}/routes`}
        class={props.active === "routes" ? "nav-link active" : "nav-link"}
      >
        Routes
      </a>
      <a
        href={`${props.prefix}/system`}
        class={props.active === "system" ? "nav-link active" : "nav-link"}
      >
        System
      </a>
      <a
        href={`${props.prefix}/services`}
        class={props.active === "services" ? "nav-link active" : "nav-link"}
      >
        Services
      </a>
    </div>
  )
}

export function Shell(props: { prefix: string; active: NavTab; children: any }) {
  return (
    <div class="shell">
      <Sidebar prefix={props.prefix} active={props.active} />
      <div class="content">{props.children}</div>
    </div>
  )
}
