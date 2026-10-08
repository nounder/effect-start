/** @jsxImportSource effect-start */
import { Bundle, Html, Route, Start } from "effect-start"
import { BunBundle, BunFileSystem, BunPath } from "effect-start/bun"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

const routes = Route.map({
  "/": Route.get(Route.html(function*() {
    const bundle = yield* Bundle.Bundle
    return [
      Html.unsafe("<!doctype html>"),
      (
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>
              Cell · JavaScript, close to the DOM
            </title>
            <style>
              {`
                :root { color-scheme: dark; background: #111; color: #ddd; }
                body { max-width: 1200px; margin: auto; padding: 24px; font: 16px/1.5 system-ui, sans-serif; }
                section { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 32px; margin-top: 32px; padding-top: 16px; }
                section > div { min-width: 0; }
                h2 { margin-top: 0; }
                button, input, select { font: inherit; padding: 4px 8px; border: 1px solid #555; border-radius: 4px; }
                button, input { padding: 3px 8px; font-size: 13px; }
                button { margin: 4px; background: #bbb; color: #111; font-weight: 600; cursor: pointer; }
                button:hover:not(:disabled) { background: #ccc; }
                button:disabled { opacity: .45; cursor: default; }
                input, select { background: #181818; color: inherit; }
                :is(button, input, select):focus-visible { outline: 2px solid #aaa; outline-offset: 2px; }
                input { display: block; box-sizing: border-box; width: 100%; margin: 8px 0; background: #bbb; color: #111; color-scheme: light; }
                input::placeholder { color: #444; opacity: 1; }
                pre { box-sizing: border-box; align-self: stretch; width: 60ch; margin: 0; padding-left: 16px; border-left: 1px solid #444; font: 13px/1.5 monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
                @media (max-width: 900px) { section { grid-template-columns: minmax(0, 1fr); } pre { width: 100%; padding: 16px 0 0; border-left: 0; border-top: 1px solid #444; } }
                output { display: block; font-size: 2rem; }
                progress { display: block; width: 100%; margin: 12px 0; }
                .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 16px 0; }
                .lanes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
                .lanes > div { min-height: 140px; padding: 12px; border: 1px dashed #444; }
              `}
            </style>
            <script type="module" src={bundle.resolve("effect-start/cell")} />
          </head>
          <body
            data-cell={(cell) => {
              cell.signals = {
                count: 0,
                status: "Ready",
                todos: [],
                build: { progress: 0, label: "Ready to build" },
                timerVisible: false,
                timerRunning: true,
                timerDelay: 1000,
                timerTicks: 0,
                timerSetups: 0,
                timerCleanups: 0,
                search: "",
                notes: [{ title: "Sketch the API" }, { title: "Try the prototype" }, {
                  title: "Ship something small",
                }],
                undo: null,
              }
            }}
          >
            <main>
              <section>
                <div>
                  <h2>
                    01 / Local interaction
                  </h2>
                  <output
                    aria-label="Count"
                    data-cell={(cell) =>
                      cell.effect(() => {
                        cell.target.textContent = cell.signals.count
                      })}
                  >
                    0
                  </output>
                  <button
                    data-cell={(cell) =>
                      cell.on("click", () => {
                        cell.signals.count++
                      })}
                  >
                    Increment locally
                  </button>
                </div>
                <pre>
{`cell => {
  cell.on('click', () => {
    cell.signals.count++
  })
}`}
                </pre>
              </section>
              <section>
                <div>
                  <h2>
                    02 / Server signals + HTML
                  </h2>
                  <p id="server-message">
                    The server has not been called yet.
                  </p>
                  <button
                    data-cell={(cell) => {
                      cell.on("click", async () => {
                        cell.target.disabled = true
                        try {
                          await cell.request("/increment", {
                            method: "POST",
                            bodyJson: { count: cell.signals.count },
                          })
                        } finally {
                          cell.target.disabled = false
                        }
                      })
                    }}
                  >
                    Increment on server
                  </button>
                </div>
                <pre>
{`await cell.request('/increment', {
  method: 'POST',
  bodyJson: { count: cell.signals.count }
})`}
                </pre>
              </section>
              <section>
                <div>
                  <h2>
                    03 / Morphing without a reset
                  </h2>
                  <div id="server-fragment">
                    <label for="draft">
                      Unsent draft
                    </label>
                    <input
                      id="draft"
                      value=""
                      placeholder="Type something to keep"
                    />
                    <p>
                      Original server fragment.
                    </p>
                  </div>
                  <button
                    data-cell={(cell) => cell.on("click", () => cell.request("/fragment"))}
                  >
                    Refresh fragment
                  </button>
                </div>
                <pre>
{`cell.on('click', () => cell.request('/fragment'))`}
                </pre>
              </section>
              <section>
                <div>
                  <h2>
                    04 / Native form submission
                  </h2>
                  <form
                    data-cell={(cell) => {
                      cell.on("submit", async (event) => {
                        event.preventDefault()
                        await cell.request("/save", {
                          method: "POST",
                          bodyForm: event,
                        })
                      })
                    }}
                  >
                    <label for="name">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      required
                      placeholder="Ada"
                    />
                    <button type="submit">
                      Save name
                    </button>
                  </form>
                  <p id="saved-name" aria-live="polite">
                    No name saved yet.
                  </p>
                </div>
                <pre>
{`cell.on('submit', async event => {
  event.preventDefault()
  await cell.request('/save', {
    method: 'POST',
    bodyForm: event
  })
})`}
                </pre>
              </section>
              <section>
                <div>
                  <h2>
                    05 / Local list + conditional content
                  </h2>
                  <form
                    data-cell={(cell) =>
                      cell.on("submit", (event) => {
                        event.preventDefault()
                        const input = cell.target.elements.namedItem("todo") as HTMLInputElement
                        const title = input.value.trim()
                        if (!title) return
                        cell.signals.todos.push({ title })
                        input.value = ""
                        input.focus()
                      })}
                  >
                    <label for="todo">
                      New reminder
                    </label>
                    <input
                      id="todo"
                      name="todo"
                      required
                      placeholder="Try a template"
                    />
                    <button type="submit">
                      Add reminder
                    </button>
                  </form>
                  <template data-cell={(cell) => cell.expand(() => cell.signals.todos.length)}>
                    <ol aria-label="Local reminders">
                      <template data-cell={(cell) => cell.expand(() => cell.signals.todos)}>
                        <li>
                          <span
                            data-cell={(cell) =>
                              cell.effect(() => {
                                cell.target.textContent = cell.item.title
                              })}
                          >
                          </span>
                          <button
                            data-cell={(cell) =>
                              cell.on("click", () => {
                                cell.signals.todos.splice(cell.index, 1)
                              })}
                          >
                            Remove reminder
                          </button>
                        </li>
                      </template>
                    </ol>
                  </template>
                  <template data-cell={(cell) => cell.expand(() => !cell.signals.todos.length)}>
                    <p>
                      No reminders yet.
                    </p>
                  </template>
                </div>
                <pre>
{`cell => cell.expand(() => cell.signals.todos)
cell => cell.expand(() => cell.signals.todos.length)`}
                </pre>
              </section>
              <section>
                <div>
                  <h2>
                    06 / A live SSE build
                  </h2>
                  <strong
                    aria-live="polite"
                    data-cell={(cell) =>
                      cell.effect(() => {
                        cell.target.textContent = cell.signals.build.label
                      })}
                  >
                    Ready to build
                  </strong>
                  <progress
                    aria-label="Build progress"
                    max="100"
                    value="0"
                    data-cell={(cell) =>
                      cell.effect(() => {
                        cell.target.value = cell.signals.build.progress
                      })}
                  >
                  </progress>
                  <button
                    data-cell={(cell) =>
                      cell.on("click", () =>
                        cell.request("/build").catch((error) => {
                          cell.signals.build.label = "Build failed: " + String(error)
                        }))}
                  >
                    Start build
                  </button>
                  <ol id="build-log">
                    <li>
                      Waiting for the server.
                    </li>
                  </ol>
                </div>
                <pre>
{`await cell.request('/build')`}
                </pre>
              </section>
              <section>
                <div>
                  <h2>
                    07 / An interval with a lifetime
                  </h2>
                  <div class="controls">
                    <button
                      data-cell={(cell) => {
                        cell.effect(() => {
                          cell.target.textContent = cell.signals.timerVisible ? "Remove timer" : "Mount timer"
                        })
                        cell.on("click", () => {
                          cell.signals.timerVisible = !cell.signals.timerVisible
                        })
                      }}
                    >
                      Mount timer
                    </button>
                    <button
                      data-cell={(cell) => {
                        cell.effect(() => {
                          cell.target.disabled = !cell.signals.timerVisible
                        })
                        cell.on("click", () => {
                          const template = document.getElementById("timer-blueprint")!
                          const destination = document.getElementById(
                            template
                                .parentElement!
                                .id === "timer-left"
                              ? "timer-right"
                              : "timer-left",
                          )!
                          destination.append(template)
                        })
                      }}
                    >
                      Move timer
                    </button>
                    <button
                      data-cell={(cell) => {
                        cell.effect(() => {
                          cell.target.disabled = !cell.signals.timerVisible
                          cell.target.textContent = cell.signals.timerRunning ? "Pause timer" : "Resume timer"
                        })
                        cell.on("click", () => {
                          cell.signals.timerRunning = !cell.signals.timerRunning
                        })
                      }}
                    >
                      Pause timer
                    </button>
                    <label for="timer-speed">
                      Tick every
                    </label>
                    <select
                      id="timer-speed"
                      data-cell={(cell) =>
                        cell.on("change", () => {
                          cell.signals.timerDelay = Number(cell.target.value)
                        })}
                    >
                      <option value="1000">
                        1 second
                      </option>
                      <option value="500">
                        500 ms
                      </option>
                      <option value="200">
                        200 ms
                      </option>
                    </select>
                  </div>
                  <div class="lanes">
                    <div id="timer-left">
                      <strong>
                        Spot A
                      </strong>
                      <template id="timer-blueprint" data-cell={(cell) => cell.expand(() => cell.signals.timerVisible)}>
                        <div
                          data-cell={(cell) => {
                            cell.signals.timerSetups++
                            cell.effect(() => {
                              const delay = cell.signals.timerDelay
                              if (!cell.signals.timerRunning) return
                              const timer = setInterval(() => {
                                cell.signals.timerTicks++
                              }, delay)
                              return () => {
                                clearInterval(timer)
                                cell.signals.timerCleanups++
                              }
                            })
                          }}
                        >
                          <span
                            data-cell={(cell) =>
                              cell.effect(() => {
                                cell.target.textContent = cell.signals.timerRunning ? "Ticking" : "Paused"
                              })}
                          >
                            Ticking
                          </span>
                          <output
                            aria-label="Timer ticks"
                            data-cell={(cell) =>
                              cell.effect(() => {
                                cell.target.textContent = cell.signals.timerTicks
                              })}
                          >
                            0
                          </output>
                        </div>
                      </template>
                    </div>
                    <div id="timer-right">
                      <strong>
                        Spot B
                      </strong>
                    </div>
                  </div>
                  <p class="controls">
                    <span
                      data-cell={(cell) =>
                        cell.effect(() => {
                          cell.target.textContent = "Cell setups: " + cell.signals.timerSetups
                        })}
                    >
                    </span>
                    <span
                      data-cell={(cell) =>
                        cell.effect(() => {
                          cell.target.textContent = "Intervals cleared: " + cell.signals.timerCleanups
                        })}
                    >
                    </span>
                    <span
                      data-cell={(cell) =>
                        cell.effect(() => {
                          cell.target.textContent = "Total ticks: " + cell.signals.timerTicks
                        })}
                    >
                    </span>
                  </p>
                </div>
                <pre>
{`cell.effect(() => {
  const delay = cell.signals.timerDelay
  if (!cell.signals.timerRunning) return
  const timer = setInterval(() => {
    cell.signals.timerTicks++
  }, delay)
  return () => clearInterval(timer)
})`}
                </pre>
              </section>
              <section>
                <div>
                  <h2>
                    08 / Search that cancels stale work
                  </h2>
                  <label for="pattern-search">
                    Find an example
                  </label>
                  <input
                    id="pattern-search"
                    type="search"
                    placeholder="Try server, template, or timer"
                    autocomplete="off"
                    data-cell={(cell) => {
                      let request: AbortController | undefined
                      const search = cell.limit((q: string) => {
                        request = new AbortController()
                        cell
                          .request("/search", { urlParams: { q }, signal: request.signal })
                          .catch((error) => {
                            document.getElementById("search-results")!.textContent = "Search failed: " + String(error)
                          })
                      }, { debounce: 300 })
                      cell.on("input", (e) => {
                        cell.signals.search = (e.target as HTMLInputElement).value
                      })
                      cell.effect(() => {
                        request?.abort()
                        search(cell.signals.search)
                      })
                    }}
                  />
                  <div id="search-results" aria-live="polite">
                    <p>
                      Try “server”, “template”, or “timer”.
                    </p>
                  </div>
                </div>
                <pre>
{`const search = cell.limit(
  q => cell.request('/search', { urlParams: { q } }),
  { debounce: 300 }
)

cell.on('input', e => search(e.target.value))`}
                </pre>
              </section>
              <section>
                <div>
                  <h2>
                    09 / A deletion you can undo
                  </h2>
                  <ul aria-label="Notes">
                    <template data-cell={(cell) => cell.expand(() => cell.signals.notes)}>
                      <li>
                        <span
                          data-cell={(cell) =>
                            cell.effect(() => {
                              cell.target.textContent = cell.item.title
                            })}
                        >
                        </span>
                        <button
                          data-cell={(cell) =>
                            cell.on("click", () => {
                              cell.signals.undo = { item: cell.item, index: cell.index }
                              cell.signals.notes.splice(cell.index, 1)
                            })}
                        >
                          Delete note
                        </button>
                      </li>
                    </template>
                  </ul>
                  <template data-cell={(cell) => cell.expand(() => !cell.signals.notes.length)}>
                    <p>
                      All notes removed. Reset them to try again.
                    </p>
                  </template>
                  <template data-cell={(cell) => cell.expand(() => cell.signals.undo)}>
                    <div
                      aria-live="polite"
                      data-cell={(cell) =>
                        cell.effect(() => {
                          const pending = cell.signals.undo
                          if (!pending) return
                          const timer = setTimeout(() => {
                            if (cell.signals.undo === pending) cell.signals.undo = null
                          }, 5000)
                          return () => clearTimeout(timer)
                        })}
                    >
                      <span
                        data-cell={(cell) =>
                          cell.effect(() => {
                            cell.target.textContent = "Removed: " + (cell.signals.undo?.item.title ?? "")
                          })}
                      >
                      </span>
                      <button
                        data-cell={(cell) =>
                          cell.on("click", () => {
                            const pending = cell.signals.undo
                            if (!pending) return
                            cell.signals.notes.splice(pending.index, 0, pending.item)
                            cell.signals.undo = null
                          })}
                      >
                        Undo deletion
                      </button>
                    </div>
                  </template>
                  <div class="controls">
                    <button
                      data-cell={(cell) =>
                        cell.on("click", () => {
                          cell.signals.undo = null
                          cell.signals.notes = [{ title: "Sketch the API" }, { title: "Try the prototype" }, {
                            title: "Ship something small",
                          }]
                        })}
                    >
                      Reset notes
                    </button>
                  </div>
                </div>
                <pre>
{`cell.effect(() => {
  const pending = cell.signals.undo
  if (!pending) return
  const timer = setTimeout(() => {
    cell.signals.undo = null
  }, 5000)
  return () => clearTimeout(timer)
})`}
                </pre>
              </section>
              <section>
                <div>
                  <h2>
                    10 / Placement in the response
                  </h2>
                  <form
                    data-cell={(cell) => {
                      cell.on("submit", async (event) => {
                        event.preventDefault()
                        await cell.request("/messages", {
                          method: "POST",
                          bodyForm: event,
                        })
                      })
                    }}
                  >
                    <label for="message">
                      Message
                    </label>
                    <input
                      id="message"
                      name="message"
                      required
                      placeholder="Hello from the server"
                    />
                    <button type="submit">
                      Send message
                    </button>
                  </form>
                  <ol id="messages" aria-label="Messages" aria-live="polite">
                    <li>
                      Existing messages stay in the list.
                    </li>
                  </ol>
                </div>
                <pre>
{`<li data-cell={cell => cell.move('#messages')}>
  {ctx.body.message}
</li>`}
                </pre>
              </section>
            </main>
            <p
              aria-live="polite"
              data-cell={(cell) => {
                cell.effect(() => {
                  cell.target.textContent = cell.signals.status
                })
                const update = (event) => {
                  cell.signals.status = "Request " + event.detail.phase
                }
                document.addEventListener("cell:request", update, { signal: cell.abortSignal })
              }}
            >
              Ready
            </p>
          </body>
        </html>
      ),
    ]
  })),
  "/increment": Route.post(
    Route.schemaBodyJson({ count: Schema.Number }),
    Route.sse((ctx) => {
      const count = ctx.body.count + 1
      return Stream.fromIterable([
        { event: "datastar-patch-signals", data: JSON.stringify({ signals: { count } }) },
        {
          event: "datastar-patch-elements",
          data: Html.text(
            <p id="server-message">
              The server incremented the count to {count}.
            </p>,
          ),
        },
      ])
    }),
  ),
  "/fragment": Route.get(Route.html(function*() {
    return (
      <div id="server-fragment">
        <label for="draft">
          Unsent draft
        </label>
        <input
          id="draft"
          value=""
          placeholder="Type something to keep"
        />
        <p>
          Server fragment refreshed at {new Date().toLocaleTimeString()}.
        </p>
      </div>
    )
  })),
  "/save": Route.post(
    Route.schemaBodyForm({ name: Schema.String }),
    Route.html(function*(ctx) {
      return (
        <p id="saved-name" aria-live="polite">
          Saved name: {ctx.body.name.trim()}.
        </p>
      )
    }),
  ),
  "/messages": Route.post(
    Route.schemaBodyForm({ message: Schema.String }),
    Route.html(function*(ctx) {
      return (
        <li
          data-cell={(cell) => {
            cell.move("#messages")
          }}
        >
          {ctx.body.message}
        </li>
      )
    }),
  ),
  "/build": Route.get(Route.sse(
    Stream
      .fromIterable([
        {
          event: "datastar-patch-signals",
          data: JSON.stringify({ signals: { build: { progress: 0, label: "Starting build" } } }),
        },
        {
          event: "datastar-patch-elements",
          data: Html.text(
            <ol id="build-log">
              <li>
                Build started.
              </li>
            </ol>,
          ),
        },
      ])
      .pipe(
        Stream.concat(
          Stream
            .fromIterable([
              { progress: 20, label: "Reading source files" },
              { progress: 40, label: "Compiling modules" },
              { progress: 60, label: "Bundling assets" },
              { progress: 80, label: "Checking output" },
              { progress: 100, label: "Build complete" },
            ])
            .pipe(
              Stream.mapEffect((build) =>
                Effect.gen(function*() {
                  yield* Effect.sleep(700)
                  return [
                    { event: "datastar-patch-signals", data: JSON.stringify({ signals: { build } }) },
                    {
                      event: "datastar-patch-elements",
                      data: Html.text(
                        <li
                          data-cell={(cell) => {
                            cell.move("#build-log")
                          }}
                        >
                          {build.label}
                        </li>,
                      ),
                    },
                  ]
                })
              ),
              Stream.flatMap((events) => Stream.fromIterable(events)),
            ),
        ),
      ),
  )),
  "/search": Route.get(
    Route.schemaSearchParams({ q: Schema.optional(Schema.String) }),
    Route.html(function*(ctx) {
      const query = ctx.searchParams.q?.trim().toLowerCase() ?? ""
      yield* Effect.sleep(200)
      const matches = [
        { title: "Local interaction", description: "Native events and shared reactive signals." },
        { title: "Server signals + HTML", description: "One server request patches signals and morphs HTML over SSE." },
        {
          title: "Morphing without a reset",
          description: "Keep local input state when the server refreshes a fragment.",
        },
        { title: "Native form submission", description: "Submit FormData and render a server response." },
        {
          title: "Local list + conditional content",
          description: "Expand template blueprints from arrays and conditions.",
        },
        { title: "A live SSE build", description: "Stream progress and HTML from the server." },
        { title: "An interval with a lifetime", description: "Move a timer and clean up its interval when it stops." },
        { title: "Search that cancels stale work", description: "Debounce input and cancel an older server request." },
        { title: "A deletion you can undo", description: "Restore a deleted note before its notification expires." },
        {
          title: "Placement in the response",
          description: "Returned HTML uses cell.move to choose its destination.",
        },
      ]
        .filter((example) => `${example.title} ${example.description}`.toLowerCase().includes(query))
      return (
        <div id="search-results" aria-live="polite">
          {!query
            ? (
              <p>
                Try “server”, “template”, or “timer”.
              </p>
            )
            : matches.length
            ? (
              <ul>
                {matches.map((example) => (
                  <li>
                    <strong>
                      {example.title}
                    </strong>
                    <br />
                    {example.description}
                  </li>
                ))}
              </ul>
            )
            : (
              <p>
                No examples match “{ctx.searchParams.q}”.
              </p>
            )}
        </div>
      )
    }),
  ),
})

if (import.meta.main) {
  Start.serve(Start.pack(
    Route.layer(routes),
    BunBundle.layer({ entrypoints: ["effect-start/cell"] }),
    BunFileSystem.layer,
    BunPath.layer,
  ))
}
