import type * as TowerStore from "../TowerStore.ts"

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

function StatCard(options: { label: string; value: string; sub?: string }) {
  return (
    <div style="background:#111827;border:1px solid #374151;border-radius:6px;padding:12px;min-width:180px">
      <div style="color:#9ca3af;font-size:11px;margin-bottom:4px">{options.label}</div>
      <div style="color:#f3f4f6;font-size:22px;font-weight:700;font-family:monospace">{options.value}</div>
      {options.sub && <div style="color:#6b7280;font-size:10px;margin-top:2px">{options.sub}</div>}
    </div>
  )
}

function BarMeter(options: { label: string; used: number; total: number }) {
  const pct = options.total > 0 ? (options.used / options.total) * 100 : 0
  const color = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e"
  return (
    <div style="background:#111827;border:1px solid #374151;border-radius:6px;padding:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:#9ca3af;font-size:11px">{options.label}</span>
        <span style="color:#e5e7eb;font-size:11px;font-family:monospace">
          {formatBytes(options.used)} / {formatBytes(options.total)}
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

export function SystemStatsView(options: { stats: TowerStore.ProcessStats }) {
  const cpuTotal = options.stats.cpu.user + options.stats.cpu.system
  return (
    <>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:12px">
        <StatCard
          label="PID"
          value={String(options.stats.pid)}
          sub={`${options.stats.system.platform} ${options.stats.system.arch}`}
        />
        <StatCard label="Uptime" value={formatUptime(options.stats.uptime)} />
        <StatCard
          label="CPU Time"
          value={`${(cpuTotal / 1_000_000).toFixed(2)}s`}
          sub={`user ${(options.stats.cpu.user / 1_000_000).toFixed(2)}s / sys ${(options.stats.cpu.system / 1_000_000).toFixed(2)}s`}
        />
        <StatCard
          label="Load Average"
          value={options.stats.system.loadavg[0].toFixed(2)}
          sub={`${options.stats.system.loadavg[0].toFixed(2)} / ${options.stats.system.loadavg[1].toFixed(2)} / ${options.stats.system.loadavg[2].toFixed(2)}  (${options.stats.system.cpuCount} cores)`}
        />
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;padding:0 12px 12px">
        <BarMeter label="Heap Memory" used={options.stats.memory.heapUsed} total={options.stats.memory.heapTotal} />
        <BarMeter
          label="System Memory"
          used={options.stats.system.totalmem - options.stats.system.freemem}
          total={options.stats.system.totalmem}
        />
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:0 12px 12px">
        <StatCard label="RSS" value={formatBytes(options.stats.memory.rss)} />
        <StatCard label="Peak RSS" value={formatBytes(options.stats.resourceUsage.maxRSS)} />
        <StatCard label="External" value={formatBytes(options.stats.memory.external)} />
        <StatCard label="Array Buffers" value={formatBytes(options.stats.memory.arrayBuffers)} />
      </div>
      <div style="padding:0 12px 12px">
        <div style="background:#111827;border:1px solid #374151;border-radius:6px;padding:12px">
          <div style="color:#9ca3af;font-size:11px;margin-bottom:8px">Resource Usage</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px">
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">Page Faults (minor)</span>
              <span style="color:#e5e7eb;font-family:monospace">
                {options.stats.resourceUsage.minorPageFault}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">Page Faults (major)</span>
              <span style="color:#e5e7eb;font-family:monospace">
                {options.stats.resourceUsage.majorPageFault}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">FS Reads</span>
              <span style="color:#e5e7eb;font-family:monospace">{options.stats.resourceUsage.fsRead}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">FS Writes</span>
              <span style="color:#e5e7eb;font-family:monospace">{options.stats.resourceUsage.fsWrite}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">Context Switches (vol)</span>
              <span style="color:#e5e7eb;font-family:monospace">
                {options.stats.resourceUsage.voluntaryContextSwitches}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#6b7280">Context Switches (invol)</span>
              <span style="color:#e5e7eb;font-family:monospace">
                {options.stats.resourceUsage.involuntaryContextSwitches}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
