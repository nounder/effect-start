export default `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #0f172a;
  color: #e5e7eb;
}
.shell { display: flex; height: 100%; }
.sidebar {
  width: 180px;
  background: #1e293b;
  border-right: 1px solid #334155;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}
.sidebar-title {
  font-size: 14px;
  font-weight: 700;
  color: #f1f5f9;
  height: 45px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #334155;
  margin-bottom: 8px;
}
.nav-link {
  display: block;
  padding: 8px 16px;
  color: #94a3b8;
  text-decoration: none;
  font-size: 13px;
}
.nav-link:hover { color: #e2e8f0; background: #334155; }
.nav-link.active {
  color: #38bdf8;
  background: #0f172a;
  border-right: 2px solid #38bdf8;
}
.content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.tab-header {
  font-size: 15px;
  font-weight: 600;
  height: 45px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
}
.tab-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  overflow-anchor: auto;
}
.filter-bar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid #1e293b;
}
.filter-bar select, .filter-bar input {
  background: #1e293b;
  border: 1px solid #334155;
  color: #e5e7eb;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.filter-bar input { flex: 1; }
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.empty {
  color: #64748b;
  font-size: 13px;
  text-align: center;
  padding: 48px 0;
  grid-column: 1 / -1;
}
.sparkline {
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 32px;
  width: 100%;
}
.sparkline-bar {
  flex: 1;
  height: 100%;
  position: relative;
  display: flex;
  align-items: flex-end;
  min-width: 0;
  margin: 0 1px;
}
.sparkline-fill {
  width: 100%;
  background: #60a5fa;
}
.sparkline-empty {
  background: transparent;
}
.sparkline-popover {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-family: monospace;
  color: #e5e7eb;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 80ms;
  z-index: 10;
}
.sparkline-popover-time {
  color: #9ca3af;
  font-size: 10px;
  margin-top: 2px;
}
.sparkline-bar:hover .sparkline-fill {
  background: #93c5fd;
}
.sparkline-bar:hover .sparkline-popover {
  opacity: 1;
}

.wf-grid {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  overflow-x: hidden;
}
.wf-row {
  display: grid;
  grid-template-columns: minmax(200px, 30%) 1fr;
  width: 100%;
  cursor: default;
}
.wf-row:hover > .wf-name,
.wf-row:hover > .wf-bar-cell { background: #1e293b; }
.wf-popover {
  margin: 0;
  margin-left: 8px;
  padding: 0;
  border: 1px solid #334155;
  border-radius: 6px;
  background: #0b1220;
  color: #e5e7eb;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  inset: auto;
  position-area: right span-bottom;
  position-try-fallbacks: left span-bottom, right span-top, left span-top;
  max-width: min(560px, 60vw);
  min-width: 280px;
  font-size: 12px;
}
.wf-popover[popover]:popover-open {
  display: block;
}
.wf-detail {
  padding: 8px 12px;
  background: #0b1220;
  border-radius: 6px;
}
.wf-name {
  padding: 4px 8px 4px 0;
  font-family: monospace;
  color: #d1d5db;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.wf-bar-cell {
  padding: 4px 8px;
  position: relative;
  display: flex;
  align-items: center;
}
.wf-bar {
  height: 14px;
  border-radius: 2px;
  position: absolute;
  min-width: 2px;
  top: 50%;
  transform: translateY(-50%);
}
.wf-dur {
  position: absolute;
  color: #9ca3af;
  font-family: monospace;
  font-size: 11px;
  white-space: nowrap;
  top: 50%;
  transform: translateY(-50%);
}
.wf-axis {
  display: grid;
  grid-template-columns: minmax(200px, 30%) 1fr;
  border-bottom: 1px solid #334155;
  font-size: 11px;
  color: #64748b;
  font-family: monospace;
}
.wf-axis-ticks { display: flex; justify-content: space-between; padding: 4px 8px; }

.wf-tree {
  position: relative;
  align-self: stretch;
  flex-shrink: 0;
}
.wf-vline {
  position: absolute;
  width: 1px;
  background: #475569;
  top: 0;
  bottom: 0;
}
.wf-elbow {
  position: absolute;
  width: 1px;
  background: #475569;
  top: 0;
  height: 50%;
}
.wf-hline {
  position: absolute;
  height: 1px;
  background: #475569;
  width: 12px;
  top: 50%;
}

.wf-badge {
  font-size: 10px;
  padding: 0 5px;
  border-radius: 8px;
  background: #1e293b;
  color: #64748b;
  flex-shrink: 0;
}

.mini-wf {
  height: 20px;
  background: #1f2937;
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}
.mini-wf-bar {
  position: absolute;
  height: 6px;
  border-radius: 1px;
  min-width: 2px;
  top: 50%;
  transform: translateY(-50%);
}

.trace-card {
  display: block;
  margin-bottom: 8px;
  background: #111827;
  border: 1px solid #1e293b;
  border-radius: 6px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;
}
.trace-card:hover { border-color: #475569; }

.tl-grid { font-size: 12px; }
.tl-cols { display: grid; grid-template-columns: 24px 1fr 48px 72px 90px; }
.tl-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #0f172a;
  border-bottom: 1px solid #334155;
  color: #64748b;
  font-size: 11px;
}
.tl-row { border-bottom: 1px solid #1e293b; color: inherit; text-decoration: none; }
.tl-row:hover { background: #111827; }
.tl-cell { padding: 6px 8px; display: flex; align-items: center; overflow: hidden; }
.tl-cell-name {
  font-family: monospace;
  color: #e2e8f0;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tl-cell-spans { color: #64748b; font-size: 11px; justify-content: flex-end; }
.tl-cell-dur { color: #64748b; font-family: monospace; font-size: 11px; justify-content: flex-end; }
.tl-cell-id { color: #475569; font-family: monospace; font-size: 10px; }
.tl-body { padding: 8px 12px 12px; border-top: 1px solid #1e293b; }

.span-panel {
  background: #111827;
  border: 1px solid #1e293b;
  border-radius: 6px;
  overflow: hidden;
  margin: 4px 0;
}
.span-panel-header {
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.span-panel-header:hover { background: #1e293b; }
.span-panel-body { padding: 0 12px 8px; }
`
