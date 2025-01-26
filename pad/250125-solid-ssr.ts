import { jsx } from "solid-js/h/jsx-runtime"
import { renderToStringAsync } from "solid-js/web"
import entryServer from "../src/entry-server.tsx"

globalThis.jsx = jsx

const renderSsr = (url) =>
  renderToStringAsync(() =>
    entryServer({
      url,
    }), { "timeoutMs": 4000 })
    .then((body) => {
      if (body.includes("~*~ 404 Not Found ~*~")) {
        return new Response("", {
          status: 404,
        })
      }

      return new Response(body, {
        headers: {
          "Content-Type": "text/html",
        },
      })
    })

console.log(
  await renderSsr("https://example.com/").then((v) => v.text()),
)
