import type * as StudioStore from "../StudioStore.ts"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function StatCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div style="background:#111827;border:1px solid #374151;border-radius:6px;padding:12px;min-width:180px">
      <div style="color:#9ca3af;font-size:11px;margin-bottom:4px">{props.label}</div>
      <div style="color:#f3f4f6;font-size:22px;font-weight:700;font-family:monospace">
        {props.value}
      </div>
      {props.sub && <div style="color:#6b7280;font-size:10px;margin-top:2px">{props.sub}</div>}
    </div>
  )
}

function BarMeter(props: { label: string; used: number; total: number }) {
  const pct = props.total > 0 ? (props.used / props.total) * 100 : 0
  const color = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e"
  return (
    <div style="background:#111827;border:1px solid #374151;border-radius:6px;padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:#9ca3af;font-size:11px">{props.label}</span>
        <span style="color:#e5e7eb;font-size:11px;font-family:monospace">
          {formatBytes(props.used)} / {formatBytes(props.total)}
        </span>
      </div>
      <div style="height:8px;background:#1f2937;border-radius:4px;overflow:hidden">
        <div
          style={`width:${pct.toFixed(1)}%;height:100%;background:${color};border-radius:4px;transition:width .3s`}
        />
      </div>
      <div style="color:#6b7280;font-size:10px;margin-top:2px;text-align:right">
        {pct.toFixed(1)}%
      </div>
    </div>
  )
}

export function SystemStatsView(props: { stats: StudioStore.ProcessStats }) {
  const cpuTotal = props.stats.cpu.user + props.stats.cpu.system
  return (
    <>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:12px">
        <StatCard
          label="PID"
          value={String(props.stats.pid)}
          sub={`${props.stats.system.platform} ${props.stats.system.arch}`}
        />
        <StatCard label="Uptime" value={formatUptime(props.stats.uptime)} />
        <StatCard
          label="CPU Time"
          value={`${(cpuTotal / 1_000_000).toFixed(2)}s`}
          sub={`user ${(props.stats.cpu.user / 1_000_000).toFixed(2)}s / sys ${(props.stats.cpu.system / 1_000_000).toFixed(2)}s`}
        />
        <StatCard
          label="Load Average"
          value={props.stats.system.loadavg[0].toFixed(2)}
          sub={`${props.stats.system.loadavg[0].toFixed(2)} / ${props.stats.system.loadavg[1].toFixed(2)} / ${props.stats.system.loadavg[2].toFixed(2)}  (${props.stats.system.cpuCount} cores)`}
        />
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;padding:0 12px 12px">
        <BarMeter
          label="Heap Memory"
          used={props.stats.memory.heapUsed}
          total={props.stats.memory.heapTotal}
        />
        <BarMeter
          label="System Memory"
          used={props.stats.system.totalmem - props.stats.system.freemem}
          total={props.stats.system.totalmem}
        />
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:0 12px 12px">
        <StatCard label="RSS" value={formatBytes(props.stats.memory.rss)} />
        <StatCard label="Peak RSS" value={formatBytes(props.stats.resourceUsage.maxRSS)} />
        <StatCard label="External" value={formatBytes(props.stats.memory.external)} />
        <StatCard label="Array Buffers" value={formatBytes(props.stats.memory.arrayBuffers)} />
      </div>
      <div style="padding:0 12px 12px">
        <div style="background:#111827;border:1px solid #374151;border-radius:6px;padding:12px">
          <div style="color:#9ca3af;font-size:11px;margin-bottom:8px">Resource Usage</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px">
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">Page Faults (minor)</span>
              <span style="color:#e5e7eb;font-family:monospace">
                {props.stats.resourceUsage.minorPageFault}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">Page Faults (major)</span>
              <span style="color:#e5e7eb;font-family:monospace">
                {props.stats.resourceUsage.majorPageFault}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">FS Reads</span>
              <span style="color:#e5e7eb;font-family:monospace">
                {props.stats.resourceUsage.fsRead}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">FS Writes</span>
              <span style="color:#e5e7eb;font-family:monospace">
                {props.stats.resourceUsage.fsWrite}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">Context Switches (vol)</span>
              <span style="color:#e5e7eb;font-family:monospace">
                {props.stats.resourceUsage.voluntaryContextSwitches}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">Context Switches (invol)</span>
              <span style="color:#e5e7eb;font-family:monospace">
                {props.stats.resourceUsage.involuntaryContextSwitches}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
