Bun.plugin(await import("bun-plugin-solid").then(v => v.SolidPlugin({
  generate: "ssr", hydratable: true
})));
