import type { InlineConfig } from "vite"

export async function createViteConfig({
  appType = undefined as InlineConfig["appType"],
} = {}) {
  const { default: solidPlugin } = await import("vite-plugin-solid")
  const { default: denoPlugin } = await import("@deno/vite-plugin")

  const logger = {
    warnOnce(msg, options) {
      console.warn(msg, options)
    },
    warn(msg, options) {
      console.warn(msg, options)
    },
    error(msg, options) {
      console.error(msg, options)
    },
    hasErrorLogged(msg) {
      return false
    },
    hasWarned: false,
    info(msg, options) {
      console.info(msg, options)
    },
    clearScreen() {
    },
  }

  const config: InlineConfig = {
    // don't include HTML middlewares. we'll render it on our side
    // https://v3.vitejs.dev/config/shared-options.html#apptype
    appType,
    configFile: false,
    root: Deno.cwd(),
    publicDir: "www",

    plugins: [
      // @ts-ignore probably nothing
      denoPlugin(),
      solidPlugin(),
    ],

    server: {
      middlewareMode: true,
    },

    build: {
      manifest: true,
      outDir: "dst",
      assetsDir: "",
      rollupOptions: {
        output: {
          assetFileNames: "assets/[name]-[hash][extname]",
          // preserveModules: true,
          preserveModulesRoot: "src",
          manualChunks(id) {
            if (
              id.includes("/lib/solid-router/")
            ) {
              return "solid-router"
            }

            if (
              id.includes("/node_modules/.deno/solid-js")
            ) {
              return "solid-js"
            }
          },
          entryFileNames: (chunkInfo) => {
            return "[name]-[hash].js"
          },
        },
        input: Deno.cwd() + "/src/entry-client.tsx",
      },
    },

    clearScreen: false,
  }

  return config
}
