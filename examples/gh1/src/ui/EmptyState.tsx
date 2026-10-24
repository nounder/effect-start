export function EmptyState(props: { icon?: string; title: string; description?: string }) {
  return (
    <div class="py-12 text-center">
      {props.icon && <div class="mb-4 text-4xl text-[#8b949e]">{props.icon}</div>}
      <h3 class="mb-2 text-xl text-[#e6edf3]">{props.title}</h3>
      {props.description && <p class="text-sm text-[#8b949e]">{props.description}</p>}
    </div>
  )
}
