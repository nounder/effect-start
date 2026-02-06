"use strict"

/**
 * Extract the base name from a module specifier.
 *
 * Examples:
 *   "effect/Effect"        -> "Effect"
 *   "./FileSystem.ts"      -> "FileSystem"
 *   "../engine.ts"         -> "engine"
 *   "node:path"            -> "path"
 *   "bun"                  -> "bun"
 *   "effect"               -> "effect"
 *   "./index.ts"           -> "index"
 *   "@effect/platform"     -> "platform"
 */
function getBaseName(source) {
  // Handle node: protocol
  if (source.startsWith("node:")) {
    return source.slice(5)
  }

  // Get last path segment
  const segments = source.split("/")
  let last = segments[segments.length - 1]

  // Strip file extension (.ts, .tsx, .js, .jsx, .mjs, .cjs)
  last = last.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "")

  return last
}

function isCapitalized(name) {
  return name.length > 0 && name[0] >= "A" && name[0] <= "Z"
}

/** @type {import("eslint").ESLint.Plugin} */
module.exports = {
  meta: {
    name: "eslint-plugin-effect-start",
    version: "0.1.0",
  },
  rules: {
    "prefer-namespace-import": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Enforce namespace imports for modules with capitalized base names",
        },
        fixable: "code",
        hasSuggestions: true,
        schema: [],
        messages: {
          preferNamespace:
            'Use namespace import for module "{{source}}": import {{typePrefix}}* as {{baseName}} from "{{source}}"',
        },
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const source = node.source.value
            if (typeof source !== "string") return

            const baseName = getBaseName(source)
            if (!baseName || !isCapitalized(baseName)) return

            // Already a namespace import (with or without type-only)
            if (
              node.specifiers.length === 1
              && node.specifiers[0].type === "ImportNamespaceSpecifier"
            ) {
              return
            }

            // Skip if there are no specifiers (side-effect import)
            if (node.specifiers.length === 0) return

            // Skip if it's only a default import
            const hasNamedImports = node.specifiers.some(
              (s) => s.type === "ImportSpecifier",
            )
            if (!hasNamedImports) return

            const typePrefix = node.importKind === "type" ? "type " : ""

            context.report({
              node,
              messageId: "preferNamespace",
              data: { source, baseName, typePrefix },
              fix(fixer) {
                return fixer.replaceText(
                  node,
                  `import ${typePrefix}* as ${baseName} from "${source}"`,
                )
              },
            })
          },
        }
      },
    },

    "require-test-namespace-import": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            'Enforce namespace import for "bun:test" (import * as test from "bun:test")',
        },
        fixable: "code",
        schema: [],
        messages: {
          requireNamespace:
            'Import "bun:test" as a namespace: import * as test from "bun:test"',
        },
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const source = node.source.value
            if (source !== "bun:test") return

            // Already a namespace import
            if (
              node.specifiers.length === 1
              && node.specifiers[0].type === "ImportNamespaceSpecifier"
            ) {
              return
            }

            // Has named imports - should use namespace
            if (node.specifiers.length > 0) {
              context.report({
                node,
                messageId: "requireNamespace",
                fix(fixer) {
                  return fixer.replaceText(
                    node,
                    'import * as test from "bun:test"',
                  )
                },
              })
            }
          },
        }
      },
    },

    "test-assertion-newline": {
      meta: {
        type: "layout",
        docs: {
          description:
            "Enforce newlines between chained test assertion methods (test.expect().toBe())",
        },
        fixable: "whitespace",
        schema: [],
        messages: {
          requireNewline:
            "Each chained method in a test assertion should be on its own line",
        },
      },
      create(context) {
        /**
         * Check if a call expression is rooted in test.expect or test.expectTypeOf
         */
        function isTestAssertionChain(node) {
          let current = node

          while (current) {
            if (
              current.type === "CallExpression"
              && current.callee.type === "MemberExpression"
            ) {
              const obj = current.callee.object

              // Check for test.expect(...) or test.expectTypeOf(...)
              if (
                obj.type === "CallExpression"
                && obj.callee.type === "MemberExpression"
                && obj.callee.object.type === "Identifier"
                && obj.callee.object.name === "test"
                && obj.callee.property.type === "Identifier"
                && (obj.callee.property.name === "expect"
                  || obj.callee.property.name === "expectTypeOf")
              ) {
                return true
              }

              // Direct: test.expect(...) or test.expectTypeOf(...)
              if (
                current.callee.object.type === "Identifier"
                && current.callee.object.name === "test"
                && current.callee.property.type === "Identifier"
                && (current.callee.property.name === "expect"
                  || current.callee.property.name === "expectTypeOf")
              ) {
                return true
              }

              // Walk up the chain
              current = current.callee.object
              continue
            }

            break
          }

          return false
        }

        /**
         * Collect all member expressions in a chained call.
         */
        function getChainedMembers(node) {
          const members = []
          let current = node

          while (
            current.type === "CallExpression"
            && current.callee.type === "MemberExpression"
          ) {
            members.push(current.callee)
            current = current.callee.object
          }

          return members
        }

        return {
          ExpressionStatement(node) {
            if (node.expression.type !== "CallExpression") return
            if (!isTestAssertionChain(node.expression)) return

            const members = getChainedMembers(node.expression)

            for (const member of members) {
              const objectEndLine = member.object.loc.end.line
              const propertyStartLine = member.property.loc.start.line

              if (objectEndLine === propertyStartLine) {
                const sourceCode = context.sourceCode || context.getSourceCode()
                const dot = sourceCode.getTokenBefore(member.property)

                if (dot && dot.value === ".") {
                  context.report({
                    node: member.property,
                    messageId: "requireNewline",
                    fix(fixer) {
                      // Calculate indent: find the start of the expression statement
                      const stmtStartCol = node.loc.start.column
                      const indent = " ".repeat(stmtStartCol + 2)
                      return fixer.replaceTextRange(
                        [member.object.range[1], member.property.range[0]],
                        "\n" + indent + ".",
                      )
                    },
                  })
                }
              }
            }
          },
        }
      },
    },
  },
}
