/**
 * @see https://oxc.rs/docs/guide/usage/linter/js-plugins.html#using-js-plugins
 */
const forceNamespace = new Set(["bun:test"])

export default {
  meta: {
    name: "effect-start",
    version: "0.1.0",
  },
  rules: {
    "prefer-namespace-import": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Enforce namespace imports for modules with capitalized base names or specific forced modules",
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
            if (!baseName) return

            const forced = forceNamespace.has(source)
            if (!forced && !isCapitalized(baseName)) return

            // Already a namespace import (with or without type-only)
            if (
              node.specifiers.length === 1 &&
              node.specifiers[0].type === "ImportNamespaceSpecifier"
            ) {
              return
            }

            // Skip if there are no specifiers (side-effect import)
            if (node.specifiers.length === 0) return

            // Skip if it's only a default import (not applicable for forced modules)
            if (!forced) {
              const hasNamedImports = node.specifiers.some((s) => s.type === "ImportSpecifier")
              if (!hasNamedImports) return
            }

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

    "test-space-around": {
      meta: {
        type: "layout",
        docs: {
          description: "Enforce blank lines around test calls (test.describe, test.it, etc.)",
        },
        fixable: "whitespace",
        schema: [],
        messages: {
          requireBlankBefore: "Test call should be preceded by a blank line",
          requireBlankAfter: "Test call should be followed by a blank line",
        },
      },
      create(context) {
        const filename = context.filename || context.getFilename()
        if (!filename.endsWith(".test.ts") && !filename.endsWith(".test.tsx")) {
          return {}
        }

        function isTestCall(node) {
          return (
            node &&
            node.type === "ExpressionStatement" &&
            node.expression.type === "CallExpression" &&
            node.expression.callee.type === "MemberExpression" &&
            node.expression.callee.object.type === "Identifier" &&
            node.expression.callee.object.name === "test"
          )
        }

        function checkBlankLines(siblings) {
          const sourceCode = context.sourceCode || context.getSourceCode()

          for (let i = 0; i < siblings.length; i++) {
            const node = siblings[i]
            if (!isTestCall(node)) continue

            const prev = siblings[i - 1]
            const next = siblings[i + 1]

            if (prev) {
              if (node.loc.start.line - prev.loc.end.line < 2) {
                context.report({
                  node,
                  messageId: "requireBlankBefore",
                  fix(fixer) {
                    return fixer.insertTextAfter(sourceCode.getLastToken(prev), "\n")
                  },
                })
              }
            }

            if (next) {
              if (next.loc.start.line - node.loc.end.line < 2) {
                context.report({
                  node,
                  messageId: "requireBlankAfter",
                  fix(fixer) {
                    return fixer.insertTextAfter(sourceCode.getLastToken(node), "\n")
                  },
                })
              }
            }
          }
        }

        return {
          Program(node) {
            checkBlankLines(node.body)
          },
          BlockStatement(node) {
            checkBlankLines(node.body)
          },
        }
      },
    },

    // this doens't work reliably and may cause runtime errors
    "export-default-before-functions": {
      meta: {
        type: "suggestion",
        docs: {
          description: "Enforce export default appears before any function declarations",
        },
        schema: [],
        messages: {
          defaultAfterFunction: "export default should appear before function declarations",
        },
      },
      create(context) {
        return {
          Program(node) {
            let seenFunction = false

            for (const stmt of node.body) {
              if (!seenFunction && isFunction(stmt)) {
                seenFunction = true
              }

              if (seenFunction && stmt.type === "ExportDefaultDeclaration") {
                context.report({
                  node: stmt,
                  messageId: "defaultAfterFunction",
                })
              }
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
          requireNewline: "Each chained method in a test assertion should be on its own line",
          requireBlankBefore:
            "Test assertion should be preceded by an empty line (unless preceded by another assertion)",
          requireBlankAfter:
            "Test assertion should be followed by an empty line (unless followed by another assertion)",
        },
      },
      create(context) {
        const filename = context.filename || context.getFilename()
        if (!filename.endsWith(".test.ts") && !filename.endsWith(".test.tsx")) {
          return {}
        }

        /**
         * Check if a call expression is rooted in test.expect or test.expectTypeOf
         */
        function isTestAssertionChain(node) {
          let current = node

          while (current) {
            if (current.type === "CallExpression" && current.callee.type === "MemberExpression") {
              const obj = current.callee.object

              // Check for test.expect(...) or test.expectTypeOf(...)
              if (
                obj.type === "CallExpression" &&
                obj.callee.type === "MemberExpression" &&
                obj.callee.object.type === "Identifier" &&
                obj.callee.object.name === "test" &&
                obj.callee.property.type === "Identifier" &&
                (obj.callee.property.name === "expect" ||
                  obj.callee.property.name === "expectTypeOf")
              ) {
                return true
              }

              // Direct: test.expect(...) or test.expectTypeOf(...)
              if (
                current.callee.object.type === "Identifier" &&
                current.callee.object.name === "test" &&
                current.callee.property.type === "Identifier" &&
                (current.callee.property.name === "expect" ||
                  current.callee.property.name === "expectTypeOf")
              ) {
                return true
              }

              // Walk up the chain
              current = current.callee.object
              continue
            }

            // Handle non-call member access like .not
            if (current.type === "MemberExpression") {
              current = current.object
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

          while (current.type === "CallExpression" && current.callee.type === "MemberExpression") {
            members.push(current.callee)
            current = current.callee.object
          }

          return members
        }

        function isAssertionStatement(stmt) {
          return (
            stmt &&
            stmt.type === "ExpressionStatement" &&
            stmt.expression.type === "CallExpression" &&
            isTestAssertionChain(stmt.expression)
          )
        }

        function checkChainedNewlines(node) {
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
        }

        function checkBlankLines(siblings) {
          const sourceCode = context.sourceCode || context.getSourceCode()

          for (let i = 0; i < siblings.length; i++) {
            const node = siblings[i]
            if (!isAssertionStatement(node)) continue

            const prev = siblings[i - 1]
            const next = siblings[i + 1]

            if (prev && !isAssertionStatement(prev)) {
              if (node.loc.start.line - prev.loc.end.line < 2) {
                context.report({
                  node,
                  messageId: "requireBlankBefore",
                  fix(fixer) {
                    return fixer.insertTextAfter(sourceCode.getLastToken(prev), "\n")
                  },
                })
              }
            }

            if (next && !isAssertionStatement(next)) {
              if (next.loc.start.line - node.loc.end.line < 2) {
                context.report({
                  node,
                  messageId: "requireBlankAfter",
                  fix(fixer) {
                    return fixer.insertTextAfter(sourceCode.getLastToken(node), "\n")
                  },
                })
              }
            }
          }
        }

        return {
          ExpressionStatement(node) {
            if (node.expression.type !== "CallExpression") return
            if (!isTestAssertionChain(node.expression)) return
            checkChainedNewlines(node)
          },
          Program(node) {
            checkBlankLines(node.body)
          },
          BlockStatement(node) {
            checkBlankLines(node.body)
          },
        }
      },
    },
  },
}

function getBaseName(source) {
  // Handle node: and bun: protocols
  if (source.startsWith("node:")) {
    return source.slice(5)
  }
  if (source.startsWith("bun:")) {
    return source.slice(4)
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

function isFunction(stmt) {
  const decl = stmt.type === "ExportNamedDeclaration" && stmt.declaration ? stmt.declaration : stmt

  if (decl.type === "FunctionDeclaration") return true

  if (
    decl.type === "VariableDeclaration" &&
    decl.declarations.length > 0 &&
    decl.declarations[0].init &&
    (decl.declarations[0].init.type === "ArrowFunctionExpression" ||
      decl.declarations[0].init.type === "FunctionExpression")
  ) {
    return true
  }

  return false
}
