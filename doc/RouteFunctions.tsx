import { Route, Schema } from "effect-start"

export default Route
  .fn(
    "DeleteIssue",
    // detail route targeting an issue won't need it
    Route.schemaPayload(),
    // defining a success/failure will be optional
    Route.schemaSuccess({
      issueId: Schema.Number,
    }),
    // Route functions work exactly as the routes themselves,
    // each passed element is a handler
    function*() {
    },
  )
  .get(
    Route.html(function*(route) {
      const issue = {}

      // is an object that has some Cell-like trait
      // that renders a clientside JS for calling Route Function endppoint:
      // fetch("/", { method: "POST", json: {} })
      route.DeleteIssue

      const local = Cell.local({
        _note: "",
      })

      // many elemnets are pureply decorative
      const shortExample = h("div.btn.btn-primary", [
        local._note,
      ])
      const explicitExample = h("div", { class: "btn btn-primary " }, [
        local._note,
      ])
      // similar to Route.fn etc
      const chainLike = h(
        // a string repr sets element/id/
        "div",
        // adds data-* attribute
        h.dataset("yo", "da"),
        h.onInput(route.DeleteIssue, Cell.throttle(500)),
        [
          // explicitly make children use array to know when to break the chain
          local._note,
        ],
      )

      return (
        <>
          <div
            data-cell={(cell) => {
              // runs direclty on the browser
              cell.target.textContent = cell._note

              if (cell.mounted) {
                // runls only on mount
              }
            }}
          >
          </div>
          <div>
            {
              /* renders  default value of the local as well as adds some html comments / markers
              so clientside cell library will update that specific TextNode to that state
              */
            }
            {local._note}

            handlers and actions are composable too
            {local._note.pipe(
              Cell.throttle(500),
              // the cell chain should run on the server too
              Cell.map((v, cell) => {
                if (cell.isServer) {
                }
                return `Mapped note: ${v}`
              }),
            )}
          </div>
          {/* different ways results of a Route function */}
          <>
            <Cell.Show when={route.DeleteIssue}>
              {(action) => (
                <div>
                  Issue #{route.DeleteIssue.data.issueId} deleted
                </div>
              )}
            </Cell.Show>

            {route.DeleteIssue.ok && (
              <div>
                Issue #{route.DeleteIssue.data.issueId} deleted
              </div>
            )}
          </>
          <h1>
            {issue.title}
          </h1>
          {/* problem: we can't really specifiy whenever it's click or not */}
          <button data-cell={route.DeleteIssue.pipe(Cell.throttle(500))}>
            Delete
          </button>

          {/* how about chaining all of that. similar chain-of-execution as in routes */}
          <button
            data-cell={[
              route.DeleteIssue,
              // an alternative way to handle success on client side
              // toast() here could render a js that calls some on the page
              Cell.then((action, cell) => {
                // I wonder how could we handle internalization?
                // properties starting with underscore are local reactive state (aka signals)
                // im thinking about disallowing object as values to keep the state flat
                // i'm also thinking about putting everything in cell.localh
                // to make it super explicit. shortcuts don't matter that much
                // in the era of LLMs
                cell._note = `Issue ${action.issueId} deleted`
              }),
            ]}
          >
            Delete
          </button>

          <button
            data-cell={{
              onclick: route.DeleteIssue,
            }}
          >
            Delete
          </button>

          {/* go with the flow, althoguh its less direct and doesn't represent the html */}
          <button
            onclick={route.DeleteIssue}
          >
            Delete
          </button>
        </>
      )
    }),
  )
