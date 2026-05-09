export function EmptyState(
  props: { icon?: string; title: string; description?: string },
) {
  return (
    <div class="text-center py-12">
      {props.icon && (
        <div class="text-[#8b949e] text-4xl mb-4">
          {props.icon}
        </div>
      )}
      <h3 class="text-xl text-[#e6edf3] mb-2">
        {props.title}
      </h3>
      {props.description && (
        <p class="text-[#8b949e] text-sm">
          {props.description}
        </p>
      )}
    </div>
  )
}
