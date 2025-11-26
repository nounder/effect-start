import App from "/Users/rg/Projects/effect-start/static/react-dashboard.html"

Bun.serve({
  port: +process.env.PORT! || 4000,
  routes: {
    "/app": App,
  },
})
