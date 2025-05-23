import type {
  InlineConfig,
} from "vite"

export async function createViteConfig({
  appType = undefined as InlineConfig["appType"],
} = {}) {
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
    // don't load and merge vite config file
    configFile: false,
    root: ".",
    publicDir: "www",

    plugins: [],

    server: {
      middlewareMode: true,
    },

    build: {
      manifest: true,
      outDir: "dst",
      assetsDir: "",
    },

    clearScreen: false,
  }

  return config
}
