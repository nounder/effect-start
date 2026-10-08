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
      :root { font: 16px/1.6 system-ui, sans-serif; color: #17352d; background: #f4f5ef; }
      body { max-width: 1050px; margin: auto; padding: 48px 24px; }
      header { max-width: 720px; margin-bottom: 40px; }
      h1 { font-size: clamp(2rem, 6vw, 3.4rem); line-height: 1.15; letter-spacing: -.04em; margin: 12px 0; }
      h2 { font-size: 1.15rem; margin-top: 0; }
      p { color: #53665e; }
      .eyebrow { color: #147955; letter-spacing: .12em; font-size: 12px; font-weight: 700; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
      section { padding: 26px; background: white; border: 1px solid #dce3d8; border-radius: 16px; }
      button { font: inherit; background: #146d4e; color: white; border: 0; border-radius: 7px; padding: 10px 16px; cursor: pointer; }
      button:hover { background: #104f3a; }
      button:disabled { opacity: .5; cursor: wait; }
      input { box-sizing: border-box; font: inherit; width: 100%; border: 1px solid #bccbc0; border-radius: 7px; padding: 9px 12px; margin: 6px 0 16px; }
      pre { overflow: auto; padding: 16px; background: #f0f4ee; border-radius: 8px; font-size: 12px; line-height: 1.7; }
      output { display: block; font-size: 3rem; font-weight: 600; margin-bottom: 18px; }
      .status { min-height: 26px; color: #147955; }
      label { font-size: 14px; }
      select { font: inherit; border: 1px solid #bccbc0; border-radius: 7px; padding: 9px 12px; background: white; color: inherit; }
      progress { display: block; width: 100%; height: 18px; accent-color: #147955; margin: 12px 0; }
      .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 16px 0; }
      .secondary { color: #17352d; background: #e9efe6; }
      .secondary:hover { background: #dce6d8; }
      .wide { grid-column: 1 / -1; }
      .stream-log { min-height: 90px; padding-left: 24px; font-size: 14px; }
      .stream-log li { padding: 3px 0; }
      .timer-lanes { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .timer-lane { min-height: 160px; border: 1px dashed #a7beb0; border-radius: 10px; padding: 16px; }
      .timer-card { background: #f0f4ee; border-radius: 8px; padding: 12px; margin-top: 12px; }
      .timer-card output { font-size: 2rem; margin: 0; }
      .metrics { display: flex; flex-wrap: wrap; gap: 18px; font-size: 14px; }
      .search-results { padding-left: 20px; }
      .search-results li { margin: 12px 0; }
      .item-list { padding: 0; list-style: none; }
      .item-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; }
      .item-list button { padding: 6px 12px; }
      .toast { padding: 12px; background: #f0f4ee; border-radius: 8px; }
      @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
    `}
            </style>
            <script type="module">
              {`import { start } from ${JSON.stringify(bundle.resolve("effect-start/cell"))}; start(document);`}
            </script>
          </head>
          <body
            data-cell={(cell) => {
              cell.signals = {
                count: 0,
                status: "Ready",
                _todos: [],
                build: { progress: 0, label: "Ready to build" },
                _buildRunning: false,
                _timerVisible: false,
                _timerRunning: true,
                _timerDelay: 1000,
                _timerTicks: 0,
                _timerSetups: 0,
                _timerCleanups: 0,
                _search: "",
                _notes: [{ title: "Sketch the API" }, { title: "Try the prototype" }, {
                  title: "Ship something small",
                }],
                _undo: null,
              }
            }}
          >
            <header>
              <div class="eyebrow">
                EFFECT START / CELL PROTOTYPE
              </div>
              <h1>
                JavaScript, close to the DOM.
              </h1>
              <p>
                One attribute. A setup function. Ordinary events, shared signals, and HTML from your server.
              </p>
            </header>
            <main class="grid">
              <section>
                <h2>
                  01 / Local interaction
                </h2>
                <p>
                  The setup runs once. Only the effect reacts to changes.
                </p>
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
                <pre>
{`cell => {
  cell.on('click', () => {
    cell.signals.count++
  })
}`}
                </pre>
              </section>
              <section>
                <h2>
                  02 / Server signals + HTML
                </h2>
                <p>
                  A single request streams a signal update and an HTML patch.
                </p>
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
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ count: cell.signals.count }),
                        })
                      } finally {
                        cell.target.disabled = false
                      }
                    })
                  }}
                >
                  Increment on server
                </button>
                <pre>
{`await cell.request('/increment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ count: cell.signals.count })
})`}
                </pre>
              </section>
              <section>
                <h2>
                  03 / Morphing without a reset
                </h2>
                <p>
                  Type a draft, then fetch fresh HTML. The input node and your unsent text survive.
                </p>
                <div id="server-fragment">
                  <label for="draft">
                    Unsent draft
                  </label>
                  <input id="draft" value="" placeholder="Type something to keep" />
                  <p>
                    Original server fragment.
                  </p>
                </div>
                <button data-cell={(cell) => cell.on("click", () => cell.request("/fragment"))}>
                  Refresh fragment
                </button>
              </section>
              <section>
                <h2>
                  04 / Native form submission
                </h2>
                <p>
                  Use a real submit event and ordinary FormData.
                </p>
                <form
                  data-cell={(cell) => {
                    cell.on("submit", async (event) => {
                      event.preventDefault()
                      await cell.request("/save", {
                        method: "POST",
                        body: new FormData(cell.target, event.submitter),
                      })
                    })
                  }}
                >
                  <label for="name">
                    Name
                  </label>
                  <input id="name" name="name" required placeholder="Ada" />
                  <button type="submit">
                    Save name
                  </button>
                </form>
                <p id="saved-name" aria-live="polite">
                  No name saved yet.
                </p>
              </section>
              <section>
                <h2>
                  05 / Local list + conditional content
                </h2>
                <p>
                  Add local reminders. The list appears when it has items and disappears when empty.
                </p>
                <form
                  data-cell={(cell) =>
                    cell.on("submit", (event) => {
                      event.preventDefault()
                      const input = cell.target.elements.namedItem("todo") as HTMLInputElement
                      const title = input.value.trim()
                      if (!title) return
                      cell.signals._todos.push({ title })
                      input.value = ""
                      input.focus()
                    })}
                >
                  <label for="todo">
                    New reminder
                  </label>
                  <input id="todo" name="todo" required placeholder="Try a template" />
                  <button type="submit">
                    Add reminder
                  </button>
                </form>
                <template data-cell={(cell) => cell.expand(() => cell.signals._todos.length)}>
                  <ol aria-label="Local reminders">
                    <template data-cell={(cell) => cell.expand(() => cell.signals._todos)}>
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
                              cell.signals._todos.splice(cell.index, 1)
                            })}
                        >
                          Remove reminder
                        </button>
                      </li>
                    </template>
                  </ol>
                </template>
                <template data-cell={(cell) => cell.expand(() => !cell.signals._todos.length)}>
                  <p>
                    No reminders yet.
                  </p>
                </template>
                <pre>
{`cell => cell.expand(() => cell.signals._todos)
cell => cell.expand(() => cell.signals._todos.length)`}
                </pre>
              </section>
              <section>
                <h2>
                  06 / A live SSE build
                </h2>
                <p>
                  One request streams progress and fresh HTML over time. Cancel halfway through, or let the build
                  finish.
                </p>
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
                  data-cell={(cell) => {
                    let request: AbortController | undefined
                    cell.effect(() => {
                      cell.target.textContent = cell.signals._buildRunning ? "Cancel build" : "Start build"
                    })
                    cell.on("click", async () => {
                      if (request) {
                        request.abort()
                        cell.signals.build.label = "Build cancelled"
                        return
                      }
                      request = new AbortController()
                      cell.signals._buildRunning = true
                      try {
                        await cell.request("/build", { signal: request.signal })
                      } catch (error) {
                        cell.signals.build.label = "Build failed: " + String(error)
                      } finally {
                        request = undefined
                        cell.signals._buildRunning = false
                      }
                    })
                  }}
                >
                  Start build
                </button>
                <ol id="build-log" class="stream-log">
                  <li>
                    Waiting for the server.
                  </li>
                </ol>
                <pre>
{`await cell.request('/build', {
  signal: controller.signal
})`}
                </pre>
              </section>
              <section class="wide">
                <h2>
                  07 / An interval with a lifetime
                </h2>
                <p>
                  Mount a timer, change its speed, or move it between the two spots. Moving keeps its setup alive.
                  Pausing, changing speed, and removing it clear the previous interval.
                </p>
                <div class="controls">
                  <button
                    data-cell={(cell) => {
                      cell.effect(() => {
                        cell.target.textContent = cell.signals._timerVisible ? "Remove timer" : "Mount timer"
                      })
                      cell.on("click", () => {
                        cell.signals._timerVisible = !cell.signals._timerVisible
                      })
                    }}
                  >
                    Mount timer
                  </button>
                  <button
                    class="secondary"
                    data-cell={(cell) => {
                      cell.effect(() => {
                        cell.target.disabled = !cell.signals._timerVisible
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
                    class="secondary"
                    data-cell={(cell) => {
                      cell.effect(() => {
                        cell.target.disabled = !cell.signals._timerVisible
                        cell.target.textContent = cell.signals._timerRunning ? "Pause timer" : "Resume timer"
                      })
                      cell.on("click", () => {
                        cell.signals._timerRunning = !cell.signals._timerRunning
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
                        cell.signals._timerDelay = Number(cell.target.value)
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
                <div class="timer-lanes">
                  <div id="timer-left" class="timer-lane">
                    <strong>
                      Spot A
                    </strong>
                    <template id="timer-blueprint" data-cell={(cell) => cell.expand(() => cell.signals._timerVisible)}>
                      <div
                        class="timer-card"
                        data-cell={(cell) => {
                          cell.signals._timerSetups++
                          cell.effect(() => {
                            const delay = cell.signals._timerDelay
                            if (!cell.signals._timerRunning) return
                            const timer = setInterval(() => {
                              cell.signals._timerTicks++
                            }, delay)
                            return () => {
                              clearInterval(timer)
                              cell.signals._timerCleanups++
                            }
                          })
                        }}
                      >
                        <span
                          data-cell={(cell) =>
                            cell.effect(() => {
                              cell.target.textContent = cell.signals._timerRunning ? "Ticking" : "Paused"
                            })}
                        >
                          Ticking
                        </span>
                        <output
                          aria-label="Timer ticks"
                          data-cell={(cell) =>
                            cell.effect(() => {
                              cell.target.textContent = cell.signals._timerTicks
                            })}
                        >
                          0
                        </output>
                      </div>
                    </template>
                  </div>
                  <div id="timer-right" class="timer-lane">
                    <strong>
                      Spot B
                    </strong>
                  </div>
                </div>
                <p class="metrics">
                  <span
                    data-cell={(cell) =>
                      cell.effect(() => {
                        cell.target.textContent = "Cell setups: " + cell.signals._timerSetups
                      })}
                  >
                  </span>
                  <span
                    data-cell={(cell) =>
                      cell.effect(() => {
                        cell.target.textContent = "Intervals cleared: " + cell.signals._timerCleanups
                      })}
                  >
                  </span>
                  <span
                    data-cell={(cell) =>
                      cell.effect(() => {
                        cell.target.textContent = "Total ticks: " + cell.signals._timerTicks
                      })}
                  >
                  </span>
                </p>
                <pre>
{`cell.effect(() => {
  const delay = cell.signals._timerDelay
  if (!cell.signals._timerRunning) return
  const timer = setInterval(() => {
    cell.signals._timerTicks++
  }, delay)
  return () => clearInterval(timer)
})`}
                </pre>
              </section>
              <section>
                <h2>
                  08 / Search that cancels stale work
                </h2>
                <p>
                  Type to search the examples on the server. A short pause starts the request; another edit cancels the
                  pending work.
                </p>
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
                    const search = cell.limit((query: string) => {
                      request = new AbortController()
                      return cell
                        .request("/search?q=" + encodeURIComponent(query), { signal: request.signal })
                        .catch((error) => {
                          document.getElementById("search-results")!.textContent = "Search failed: " + String(error)
                        })
                    }, { debounce: 300, concurrency: 1 })
                    cell.on("input", () => {
                      cell.signals._search = cell.target.value
                    })
                    cell.effect(() => {
                      request?.abort()
                      search(cell.signals._search)
                    })
                  }}
                />
                <div id="search-results" aria-live="polite">
                  <p>
                    Try “server”, “template”, or “timer”.
                  </p>
                </div>
                <pre>
{`const search = cell.limit(query => {
  return cell.request('/search?q=' + encodeURIComponent(query))
}, { debounce: 300, concurrency: 1 })

cell.on('input', () => search(cell.target.value))`}
                </pre>
              </section>
              <section>
                <h2>
                  09 / A deletion you can undo
                </h2>
                <p>
                  Remove a note, then undo your last deletion within five seconds. Removing another note starts a fresh
                  undo window.
                </p>
                <ul class="item-list" aria-label="Notes">
                  <template data-cell={(cell) => cell.expand(() => cell.signals._notes)}>
                    <li>
                      <span
                        data-cell={(cell) =>
                          cell.effect(() => {
                            cell.target.textContent = cell.item.title
                          })}
                      >
                      </span>
                      <button
                        class="secondary"
                        data-cell={(cell) =>
                          cell.on("click", () => {
                            cell.signals._undo = { item: cell.item, index: cell.index }
                            cell.signals._notes.splice(cell.index, 1)
                          })}
                      >
                        Delete note
                      </button>
                    </li>
                  </template>
                </ul>
                <template data-cell={(cell) => cell.expand(() => !cell.signals._notes.length)}>
                  <p>
                    All notes removed. Reset them to try again.
                  </p>
                </template>
                <template data-cell={(cell) => cell.expand(() => cell.signals._undo)}>
                  <div
                    class="toast"
                    aria-live="polite"
                    data-cell={(cell) =>
                      cell.effect(() => {
                        const pending = cell.signals._undo
                        if (!pending) return
                        const timer = setTimeout(() => {
                          if (cell.signals._undo === pending) cell.signals._undo = null
                        }, 5000)
                        return () => clearTimeout(timer)
                      })}
                  >
                    <span
                      data-cell={(cell) =>
                        cell.effect(() => {
                          cell.target.textContent = "Removed: " + (cell.signals._undo?.item.title ?? "")
                        })}
                    >
                    </span>
                    <button
                      data-cell={(cell) =>
                        cell.on("click", () => {
                          const pending = cell.signals._undo
                          if (!pending) return
                          cell.signals._notes.splice(pending.index, 0, pending.item)
                          cell.signals._undo = null
                        })}
                    >
                      Undo deletion
                    </button>
                  </div>
                </template>
                <div class="controls">
                  <button
                    class="secondary"
                    data-cell={(cell) =>
                      cell.on("click", () => {
                        cell.signals._undo = null
                        cell.signals._notes = [{ title: "Sketch the API" }, { title: "Try the prototype" }, {
                          title: "Ship something small",
                        }]
                      })}
                  >
                    Reset notes
                  </button>
                </div>
                <pre>
{`cell.effect(() => {
  const pending = cell.signals._undo
  if (!pending) return
  const timer = setTimeout(() => {
    cell.signals._undo = null
  }, 5000)
  return () => clearTimeout(timer)
})`}
                </pre>
              </section>
            </main>
            <p
              class="status"
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
        { event: "datastar-patch-signals", data: `signals ${JSON.stringify({ count })}` },
        {
          event: "datastar-patch-elements",
          data: `elements ${
            Html.text(
              <p id="server-message">
                The server incremented the count to {count}.
              </p>,
            )
          }`,
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
        <input id="draft" value="" placeholder="Type something to keep" />
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
  "/build": Route.get(Route.sse(
    Stream
      .fromIterable([
        { event: "datastar-patch-signals", data: "signals {\"build\":{\"progress\":0,\"label\":\"Starting build\"}}" },
        {
          event: "datastar-patch-elements",
          data: `elements ${
            Html.text(
              <ol id="build-log" class="stream-log">
                <li>
                  Build started.
                </li>
              </ol>,
            )
          }`,
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
                    { event: "datastar-patch-signals", data: `signals ${JSON.stringify({ build })}` },
                    {
                      event: "datastar-patch-elements",
                      data: [
                        "selector #build-log",
                        "mode append",
                        `elements ${
                          Html.text(
                            <li>
                              {build.label}
                            </li>,
                          )
                        }`,
                      ],
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
        { title: "A live SSE build", description: "Stream progress and HTML from the server, with cancellation." },
        { title: "An interval with a lifetime", description: "Move a timer and clean up its interval when it stops." },
        { title: "Search that cancels stale work", description: "Debounce input and cancel an older server request." },
        { title: "A deletion you can undo", description: "Restore a deleted note before its notification expires." },
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
              <ul class="search-results">
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
