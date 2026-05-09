import * as Github from "Github.ts"

export function Tabs(props: {
  items: Array<
    { label: string; href: string; count?: number; active?: boolean }
  >
}) {
  return (
    <div class="flex gap-0 border-b border-[#21262d] mb-4 overflow-x-auto">
      {props.items.map((item) => (
        <a
          href={item.href}
          class={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 whitespace-nowrap transition-colors ${
            item.active
              ? "border-[#f78166] text-[#e6edf3] font-semibold"
              : "border-transparent text-[#8b949e] hover:text-[#e6edf3] hover:border-[#21262d]"
          }`}
        >
          {item.label}
          {item.count !== undefined && (
            <span class="bg-[#21262d] text-[#8b949e] rounded-full text-xs px-2 py-0.5">
              {Github.num(item.count)}
            </span>
          )}
        </a>
      ))}
    </div>
  )
}
