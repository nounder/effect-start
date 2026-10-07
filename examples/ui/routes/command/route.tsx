import { Route } from "effect-start"
import * as Schema from "effect/Schema"
import { CommandItem, CommandList, Icon } from "../../ui.tsx"

const categories = [
  "Projects",
  "Documents",
  "Teams",
  "Members",
  "Tasks",
  "Reports",
  "Settings",
  "Integrations",
  "Notifications",
  "Billing",
]
const actions = ["Open", "Create", "Edit", "Search", "Duplicate", "Archive", "Restore", "Export", "Share", "Manage"]

export default Route.get(
  Route.schemaSearchParams({
    q: Schema.optional(Schema.String),
  }),
  Route.html(function*(ctx) {
    const query = ctx.searchParams.q ?? ""
    const items = categories
      .flatMap((category) =>
        actions.map((action) => ({
          id: `command-demo-${category.toLowerCase()}-${action.toLowerCase()}`,
          label: `${action} ${category.toLowerCase()}`,
        }))
      )
      .filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    return (
      <CommandList id="command-demo-results" data-query={query} aria-label="Actions" class="h-80">
        {items.map((item) => (
          <CommandItem id={item.id} data-demo-toast={`${item.label} selected`}>
            <Icon name="arrow" />
            {item.label}
          </CommandItem>
        ))}
      </CommandList>
    )
  }),
)
