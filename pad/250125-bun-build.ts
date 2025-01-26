const out = await Bun.build({
  outdir: "dst",
  entrypoints: [
    Bun.fileURLToPath(import.meta.resolve("../src/entry-client.tsx")),
  ],
  naming: "[name]:[hash].[ext]",
})

console.log(out)
