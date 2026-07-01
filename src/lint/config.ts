type Severity =
  | "allow"
  | "off"
  | "warn"
  | "error"
  | "deny"
  | number

type RuleConfig =
  | Severity
  | [Severity, ...Array<unknown>]

// we need define plugin as union.
// otherwise a tuple is too strict for oxlint
type Plugin =
  | "typescript"
  | "import"
  | "unicorn"
  | "oxc"

type Rules = Record<string, RuleConfig>

type Config = {
  readonly plugins?: Array<Plugin>
  readonly jsPlugins?: Array<string>
  readonly categories?: {
    readonly correctness?: Severity
  }
  readonly rules?: Rules
}

const plugins: Array<Plugin> = [
  "typescript",
  "import",
  "unicorn",
  "oxc",
]

/**
 * Typescript rules commonly used in Effect ecosystem.
 */
const tsRules: Rules = {
  "object-shorthand": "error",

  "import/first": "error",
  "import/no-duplicates": "error",
  "import/no-self-import": "error",
  "import/no-empty-named-blocks": "error",

  "typescript/array-type": [
    "error",
    {
      default: "generic",
      readonly: "generic",
    },
  ],
  "typescript/consistent-type-imports": [
    "error",
    {
      fixStyle: "inline-type-imports",
    },
  ],
  "typescript/no-import-type-side-effects": "error",
  "typescript/no-unnecessary-type-assertion": "error",
  "typescript/no-unnecessary-type-constraint": "error",
  "typescript/no-useless-empty-export": "error",

  "eslint/no-console": "error",
  "eslint/no-var": "error",
  "eslint/no-useless-constructor": "error",
  "eslint/no-unneeded-ternary": "error",
  "eslint/no-useless-concat": "error",
  "oxc/misrefactored-assign-op": "error",
  "unicorn/prefer-array-flat-map": "error",
  "unicorn/no-accessor-recursion": "error",
  "unicorn/no-abusive-eslint-disable": "error",

  "typescript/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    },
  ],
  "typescript/no-non-null-assertion": "off",
  "typescript/no-explicit-any": "off",
  "typescript/no-namespace": "off",
  "typescript/no-empty-interface": "off",
  "typescript/no-require-imports": "off",

  "no-control-regex": "off",
  "no-prototype-builtins": "off",
  "no-case-declarations": "off",
  "no-empty": "off",
  "unicorn/no-nested-ternary": "off",
  "no-bitwise": "off",
  "no-empty-pattern": "off",
  "unicorn/no-new-array": "off",
  "require-yield": "off",
  "import/namespace": "off",
  "no-unused-expressions": "off",
}

/**
 * Aesthetic rules to make code more readable.
 * What can I say, I love whitespace.
 */
export const formatRules: Rules = {
  "effect-start/test-space-around": "warn",
  "effect-start/test-assertion-newline": "warn",
  "effect-start/pipe-args-newline": "warn",
}

/**
 * Our idiosyncratic rules I need but others may hate.
 */
export const ourRules: Rules = {
  "effect-start/namespace-import": "error",
  "effect-start/effect-try-promise": "error",
  "effect-start/no-destructured-params": "warn",
  "effect-start/test-effects": "warn",
  "effect-start/schema-type-helpers": "warn",
  "effect-start/tagged-symbol-name": "error",
}

/**
 * oxlint/eslint config that every Effect codebase should use (imho)
 * Includes only widely accepted rules.
 */
export const config: Config = {
  plugins,
  jsPlugins: [
    import.meta.resolve("./plugin.js"),
  ],
  categories: {
    correctness: "error",
  },
  rules: {
    ...tsRules,
  },
}

export default config
