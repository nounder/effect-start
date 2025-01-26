import entryServer from "../src/entry-server.tsx" with { type: "text" }
import tsconfig from "../tsconfig.json" with { type: "json" }

const transpiler = new Bun.Transpiler({
  loader: "tsx", // "js | "jsx" | "ts" | "tsx"
  tsconfig: tsconfig,
})

console.log(
  transpiler.transformSync(entryServer),
)
