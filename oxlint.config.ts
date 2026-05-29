import { defineConfig } from "oxlint"
import * as LintConfig from "./src/lint/config.ts"

export default defineConfig({
  extends: [
    LintConfig.config,
  ],
  rules: {
    ...LintConfig.formatRules,
    ...LintConfig.ourRules,
  },
  overrides: [
    {
      files: ["src/datastar/**"],
      rules: {
        "effect-start/no-destructured-params": "off",
        "eslint/no-console": "off",
        "eslint/no-unused-vars": "off",
        "typescript/no-unused-vars": "off",
      },
    },
  ],
})
