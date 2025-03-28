import { SolidPlugin } from "bun-plugin-solid"

Bun.plugin(
  SolidPlugin({
    generate: "ssr",
    hydratable: false,
  }),
)
