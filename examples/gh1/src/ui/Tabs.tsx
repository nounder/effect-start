import * as Github from "../Github.ts"

export function Tabs(props: {
  items: Array<{ label: string; href: string; count?: number; active?: boolean }>
}) {
  return (
    <div class="mb-4 flex gap-0 overflow-x-auto border-b border-[#21262d]">
      {props.items.map((item) => (
        <a
          href={item.href}
          class={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm whitespace-nowrap transition-colors ${
            item.active
              ? "border-[#f78166] font-semibold text-[#e6edf3]"
              : "border-transparent text-[#8b949e] hover:border-[#21262d] hover:text-[#e6edf3]"
          }`}
        >
          {item.label}
          {item.count !== undefined && (
            <span class="rounded-full bg-[#21262d] px-2 py-0.5 text-xs text-[#8b949e]">
              {Github.num(item.count)}
            </span>
          )}
        </a>
      ))}
    </div>
  )
}
