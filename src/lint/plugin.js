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
    "namespace-import": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Enforce namespace imports with matching aliases for capitalized modules and specific forced modules",
        },
        schema: [],
        messages: {
          preferNamespace:
            'Use namespace import for module "{{source}}": import * as {{baseName}} from "{{source}}"',
          mismatch:
            'Namespace import alias "{{alias}}" does not match module basename "{{baseName}}"',
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

            const isNamespace =
              node.specifiers.length === 1 && node.specifiers[0].type === "ImportNamespaceSpecifier"

            if (isNamespace) {
              if (!isLocalImport(source)) return
              const alias = node.specifiers[0].local.name
              if (alias === baseName) return

              context.report({
                node,
                messageId: "mismatch",
                data: { alias, baseName },
              })
              return
            }

            if (node.specifiers.length === 0) return

            if (!forced) {
              const hasNamedImports = node.specifiers.some((s) => s.type === "ImportSpecifier")
              if (!hasNamedImports) return
            }

            context.report({
              node,
              messageId: "preferNamespace",
              data: { source, baseName },
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

    "no-destructured-params": {
      meta: {
        type: "suggestion",
        docs: {
          description: "Disallow destructuring objects in function parameters",
        },
        fixable: "code",
        schema: [],
        messages: {
          noDestructuredParam:
            "Avoid destructuring objects in function parameters. Use a single parameter and access properties on it instead.",
        },
      },
      create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode()

        function findUnusedName(scope, base) {
          const names = new Set()
          let current = scope
          while (current) {
            for (const v of current.variables) names.add(v.name)
            current = current.upper
          }
          if (!names.has(base)) return base
          for (let i = 2; ; i++) {
            const candidate = base + i
            if (!names.has(candidate)) return candidate
          }
        }

        function isDefinition(node) {
          if (node.type === "FunctionDeclaration") return true
          const ancestors = sourceCode.getAncestors(node)
          const parent = ancestors[ancestors.length - 1]
          if (!parent) return false
          if (parent.type === "MethodDefinition" || (parent.type === "Property" && parent.method))
            return true
          if (parent.type === "VariableDeclarator" && parent.init === node) return true
          return false
        }

        function checkParams(node) {
          for (const param of node.params) {
            const pattern = param.type === "AssignmentPattern" ? param.left : param
            if (pattern.type !== "ObjectPattern") continue

            const baseName = isDefinition(node) ? "options" : "v"
            const outerScope = sourceCode.getScope(node).upper || sourceCode.getScope(node)
            const name = findUnusedName(outerScope, baseName)

            const hasPropertyDefaults = pattern.properties.some(
              (prop) => prop.type !== "RestElement" && prop.value.type === "AssignmentPattern",
            )

            context.report({
              node: pattern,
              messageId: "noDestructuredParam",
              fix: hasPropertyDefaults
                ? undefined
                : (fixer) => {
                    const fixes = []

                    const typeAnnotation = pattern.typeAnnotation
                      ? sourceCode.getText(pattern.typeAnnotation)
                      : ""
                    const hasDefault = param.type === "AssignmentPattern"
                    const defaultValue = hasDefault ? " = " + sourceCode.getText(param.right) : ""

                    fixes.push(
                      fixer.replaceTextRange(param.range, name + typeAnnotation + defaultValue),
                    )

                    const fnScope = sourceCode.getScope(node)
                    const localToKey = new Map()
                    for (const prop of pattern.properties) {
                      if (prop.type === "RestElement") continue
                      const keyName =
                        prop.key.type === "Identifier"
                          ? prop.key.name
                          : sourceCode.getText(prop.key)
                      const localNode =
                        prop.value.type === "AssignmentPattern" ? prop.value.left : prop.value
                      if (localNode.type === "Identifier") {
                        localToKey.set(localNode.name, keyName)
                      }
                    }

                    for (const variable of fnScope.variables) {
                      const keyName = localToKey.get(variable.name)
                      if (keyName === undefined) continue

                      for (const ref of variable.references) {
                        if (
                          ref.identifier.range[0] >= pattern.range[0] &&
                          ref.identifier.range[1] <= pattern.range[1]
                        )
                          continue

                        const ancestors = sourceCode.getAncestors(ref.identifier)
                        const parent = ancestors[ancestors.length - 1]
                        if (
                          parent &&
                          parent.type === "Property" &&
                          parent.shorthand &&
                          parent.value === ref.identifier
                        ) {
                          fixes.push(
                            fixer.replaceTextRange(
                              parent.range,
                              keyName + ": " + name + "." + keyName,
                            ),
                          )
                        } else {
                          fixes.push(
                            fixer.replaceTextRange(ref.identifier.range, name + "." + keyName),
                          )
                        }
                      }
                    }

                    return fixes
                  },
            })
          }
        }

        return {
          FunctionDeclaration: checkParams,
          FunctionExpression: checkParams,
          ArrowFunctionExpression: checkParams,
        }
      },
    },

    "test-effects": {
      meta: {
        type: "suggestion",
        docs: {
          description:
            "Disallow await Effect.runPromise(...) in test callbacks. Use Effect.gen(...).pipe(Effect.runPromise) as the return value instead.",
        },
        schema: [],
        messages: {
          noAwaitRunPromise:
            "Avoid Effect.runPromise in async test callbacks. Use () => Effect.gen(function*() { ... }).pipe(Effect.runPromise) instead.",
          scopedWrapping: "Use .pipe(Effect.scoped) instead of Effect.scoped(...) wrapping.",
        },
      },
      create(context) {
        const filename = context.filename || context.getFilename()
        if (!filename.endsWith(".test.ts") && !filename.endsWith(".test.tsx")) {
          return {}
        }

        function isTestCallback(node) {
          const sourceCode = context.sourceCode || context.getSourceCode()
          const ancestors = sourceCode.getAncestors(node)
          const parent = ancestors[ancestors.length - 1]
          if (!parent || parent.type !== "CallExpression") return false
          const callee = parent.callee
          return (
            callee.type === "MemberExpression" &&
            callee.object.type === "Identifier" &&
            callee.object.name === "test" &&
            callee.property.type === "Identifier" &&
            (callee.property.name === "it" || callee.property.name === "test")
          )
        }

        function findEnclosingAsyncTestCallback(node) {
          const sourceCode = context.sourceCode || context.getSourceCode()
          const ancestors = sourceCode.getAncestors(node)
          for (let i = ancestors.length - 1; i >= 0; i--) {
            const ancestor = ancestors[i]
            if (
              (ancestor.type === "ArrowFunctionExpression" ||
                ancestor.type === "FunctionExpression") &&
              ancestor.async
            ) {
              return isTestCallback(ancestor) ? ancestor : undefined
            }
          }
        }

        return {
          CallExpression(node) {
            if (
              node.callee.type === "MemberExpression" &&
              node.callee.object.type === "Identifier" &&
              node.callee.object.name === "Effect" &&
              node.callee.property.type === "Identifier" &&
              node.callee.property.name === "scoped" &&
              node.arguments.length === 1
            ) {
              context.report({
                node,
                messageId: "scopedWrapping",
              })
            }
          },
          MemberExpression(node) {
            if (
              node.object.type === "Identifier" &&
              node.object.name === "Effect" &&
              node.property.type === "Identifier" &&
              node.property.name === "runPromise" &&
              findEnclosingAsyncTestCallback(node)
            ) {
              context.report({
                node,
                messageId: "noAwaitRunPromise",
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

  // Strip leading underscores (private module convention)
  last = last.replace(/^_+/, "")

  return last
}

function isLocalImport(source) {
  return source.startsWith(".") || source.startsWith("/")
}

function isCapitalized(name) {
  if (name.length > 0 && name[0] === "_") return isCapitalized(name.slice(1))
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
