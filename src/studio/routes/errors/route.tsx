import * as Stream from "effect/Stream"
import * as Route from "../../../Route.ts"
import * as Html from "../../../Html.ts"
import * as StudioStore from "../../StudioStore.ts"
import * as Errors from "../../ui/Errors.tsx"
import * as Shell from "../../ui/Shell.tsx"

const prefix = StudioStore.store.prefix

export default Route.get(
  Route.html(function* (ctx) {
    const url = new URL(ctx.request.url)
    const search = url.searchParams.get("errorSearch") || ""
    const tag = url.searchParams.get("errorTag") || ""
    const allErrors = yield* StudioStore.allErrors()
    const tagSet = new Set<string>()
    for (const error of allErrors) {
      for (const d of error.details) {
        if (d.tag) tagSet.add(d.tag)
      }
    }
    const sortedTags = Array.from(tagSet).sort()
    let errors = allErrors
    if (tag) {
      errors = errors.filter((e) => e.details.some((d) => d.tag && d.tag.startsWith(tag)))
    }
    if (search) {
      const lower = search.toLowerCase()
      errors = errors.filter((e) => {
        const firstLine = e.prettyPrint.split("\n")[0] ?? ""
        return firstLine.toLowerCase().includes(lower)
      })
    }
    errors = errors.reverse()

    return (
      <Shell.Shell prefix={prefix} active="errors">
        <form
          data-signals={{ errorSearch: "", errorTag: "" }}
          style="display:flex;flex-direction:column;flex:1;overflow:hidden"
        >
          <div class="tab-header">Errors</div>
          <div class="filter-bar">
            <input
              type="text"
              name="errorSearch"
              placeholder="Search..."
              data-bind:errorSearch
              data-on:input={(c) => c.actions.get(location.href, { contentType: "form" })}
            />
            <input
              type="text"
              name="errorTag"
              placeholder="Tag..."
              list="error-tags"
              data-bind:errorTag
              data-on:input={(c) => c.actions.get(location.href, { contentType: "form" })}
            />
            <datalist id="error-tags">
              {sortedTags.map((t) => (
                <option value={t} />
              ))}
            </datalist>
          </div>
          <div id="errors-list" class="tab-body">
            {errors.map((e) => (
              <Errors.ErrorLine error={e} />
            ))}
          </div>

          <div data-init={`@get('${prefix}/errors')`} />
        </form>
      </Shell.Shell>
    )
  }),
  Route.sse(
    Stream.fromPubSub(StudioStore.store.events).pipe(
      Stream.filter((e) => e._tag === "Error"),
      Stream.map((e) => {
        const html = Html.renderToString(<Errors.ErrorLine error={e.error} />).replace(/\n/g, "")
        return {
          event: "datastar-patch-elements",
          data: `selector #errors-list\nmode prepend\nelements ${html}`,
        }
      }),
    ),
  ),
)
