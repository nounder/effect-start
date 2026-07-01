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
            "Use namespace import for module \"{{source}}\": import * as {{baseName}} from \"{{source}}\"",
          mismatch: "Namespace import alias \"{{alias}}\" does not match module basename \"{{baseName}}\"",
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

            const isNamespace = node.specifiers.length === 1 &&
              node.specifiers[0].type === "ImportNamespaceSpecifier"

            if (isNamespace) {
              if (!isLocalImport(source)) return
              const alias = node.specifiers[0].local.name
              if (alias === baseName) return
              if (node.importKind === "type") return

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

    "tagged-symbol-name": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Require a tagged class or const name to match the tag/identifier passed to its factory (Data.TaggedError, Schema.Class, Context.Tag, Context.GenericTag, Schema.TaggedStruct, etc.)",
        },
        fixable: "code",
        schema: [],
        messages: {
          mismatch: "{{symbolKind}} \"{{name}}\" should match its {{kind}} \"{{tag}}\" passed to {{factory}}.",
          mismatchSegment:
            "{{symbolKind}} \"{{name}}\" should match the last segment of its identifier \"{{tag}}\" passed to {{factory}}.",
        },
      },
      create(context) {
        const imports = createImportTracker("effect")

        function check(name, symbolKind, factoryExpr) {
          const info = getTaggedFactory(factoryExpr, imports)
          if (!info) return

          const arg = info.call.arguments[info.argIndex]
          if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") return

          const factory = info.object + "." + info.property

          if (info.matchSegment) {
            const tag = arg.value
            const cut = Math.max(tag.lastIndexOf("/"), tag.lastIndexOf(".")) + 1
            if (tag.slice(cut) === name) return

            context.report({
              node: arg,
              messageId: "mismatchSegment",
              data: { name, symbolKind, tag, factory },
              fix: (fixer) => fixer.replaceTextRange(arg.range, JSON.stringify(tag.slice(0, cut) + name)),
            })
            return
          }

          if (arg.value === name) return

          context.report({
            node: arg,
            messageId: "mismatch",
            data: { name, symbolKind, kind: info.kind, tag: arg.value, factory },
            fix: (fixer) => fixer.replaceTextRange(arg.range, JSON.stringify(name)),
          })
        }

        function checkClass(node) {
          if (node.id && node.superClass) check(node.id.name, "Class", node.superClass)
        }

        return {
          ImportDeclaration: imports.ImportDeclaration,
          ClassDeclaration: checkClass,
          ClassExpression: checkClass,
          VariableDeclarator(node) {
            if (node.id.type === "Identifier" && node.init) {
              check(node.id.name, "Const", node.init)
            }
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
                    return fixer.insertTextAfter(
                      sourceCode.getLastToken(prev),
                      "\n",
                    )
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
                    return fixer.insertTextAfter(
                      sourceCode.getLastToken(node),
                      "\n",
                    )
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

    "schema-type-helpers": {
      meta: {
        type: "suggestion",
        docs: {
          description: "Prefer `typeof User.Type` over `Schema.Schema.Type<typeof User>`",
        },
        fixable: "code",
        schema: [],
        messages: {
          preferTypeof: "Use `typeof {{name}}.Type` instead of `Schema.Schema.Type<typeof {{name}}>`",
        },
      },
      create(context) {
        const imports = createImportTracker("effect")

        function walk(node) {
          if (!node || typeof node !== "object") return
          if (Array.isArray(node)) {
            for (const child of node) walk(child)
            return
          }
          if (node.type === "TSTypeReference") {
            checkTypeRef(context, node, imports)
            return
          }
          for (const key of Object.keys(node)) {
            if (key === "parent") continue
            walk(node[key])
          }
        }
        return {
          ImportDeclaration: imports.ImportDeclaration,
          TSTypeAliasDeclaration(node) {
            walk(node.typeAnnotation)
          },
        }
      },
    },

    "effect-try-promise": {
      meta: {
        type: "suggestion",
        docs: {
          description: "Require Effect.tryPromise to use object form with try and catch",
        },
        schema: [],
        messages: {
          objectForm: "Prefer Effect.tryPromise({ try, catch }) so promise errors are mapped explicitly.",
        },
      },
      create(context) {
        const imports = createImportTracker("effect")

        function hasProperty(node, name) {
          return node.properties.some((property) => {
            if (property.type === "SpreadElement") return false
            const key = property.key
            if (key.type === "Identifier" && key.name === name) return true
            if (key.type === "Literal" && key.value === name) return true
            return false
          })
        }

        return {
          ImportDeclaration: imports.ImportDeclaration,
          CallExpression(node) {
            if (!imports.isMember(node.callee, "Effect", "tryPromise")) return

            const options = node.arguments[0]
            if (
              options?.type === "ObjectExpression" &&
              hasProperty(options, "try") &&
              hasProperty(options, "catch")
            ) {
              return
            }

            context.report({
              node,
              messageId: "objectForm",
            })
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
          for (let i = 2;; i++) {
            const candidate = base + i
            if (!names.has(candidate)) return candidate
          }
        }

        function isDefinition(node) {
          if (node.type === "FunctionDeclaration") return true
          const ancestors = sourceCode.getAncestors(node)
          const parent = ancestors[ancestors.length - 1]
          if (!parent) return false
          if (
            parent.type === "MethodDefinition" ||
            (parent.type === "Property" && parent.method)
          ) {
            return true
          }
          if (parent.type === "VariableDeclarator" && parent.init === node) {
            return true
          }
          return false
        }

        function checkParams(node) {
          for (const param of node.params) {
            const pattern = param.type === "AssignmentPattern"
              ? param.left
              : param
            if (pattern.type !== "ObjectPattern") continue

            const baseName = isDefinition(node) ? "options" : "v"
            const outerScope = sourceCode.getScope(node).upper ||
              sourceCode.getScope(node)
            const name = findUnusedName(outerScope, baseName)

            const hasPropertyDefaults = pattern.properties.some(
              (prop) =>
                prop.type !== "RestElement" &&
                prop.value.type === "AssignmentPattern",
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
                  const defaultValue = hasDefault
                    ? " = " + sourceCode.getText(param.right)
                    : ""

                  fixes.push(
                    fixer.replaceTextRange(
                      param.range,
                      name + typeAnnotation + defaultValue,
                    ),
                  )

                  const fnScope = sourceCode.getScope(node)
                  const localToKey = new Map()
                  for (const prop of pattern.properties) {
                    if (prop.type === "RestElement") continue
                    const keyName = prop.key.type === "Identifier"
                      ? prop.key.name
                      : sourceCode.getText(prop.key)
                    const localNode = prop.value.type === "AssignmentPattern"
                      ? prop.value.left
                      : prop.value
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
                      ) {
                        continue
                      }

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
                          fixer.replaceTextRange(
                            ref.identifier.range,
                            name + "." + keyName,
                          ),
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

        const effect = createImportTracker("effect")
        const bunTest = createImportTracker("bun:test")

        function isTestCallback(node) {
          const sourceCode = context.sourceCode || context.getSourceCode()
          const ancestors = sourceCode.getAncestors(node)
          const parent = ancestors[ancestors.length - 1]
          if (!parent || parent.type !== "CallExpression") return false
          const callee = parent.callee
          return (
            bunTest.isMember(callee, "bun:test", "it") ||
            bunTest.isMember(callee, "bun:test", "test")
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
          ImportDeclaration(node) {
            effect.ImportDeclaration(node)
            bunTest.ImportDeclaration(node)
          },
          CallExpression(node) {
            if (effect.isMember(node.callee, "Effect", "scoped") && node.arguments.length === 1) {
              context.report({
                node,
                messageId: "scopedWrapping",
              })
            }
          },
          MemberExpression(node) {
            if (effect.isMember(node, "Effect", "runPromise") && findEnclosingAsyncTestCallback(node)) {
              context.report({
                node,
                messageId: "noAwaitRunPromise",
              })
            }
          },
        }
      },
    },

    "pipe-args-newline": {
      meta: {
        type: "layout",
        docs: {
          description:
            "Enforce each argument of .pipe(...) and Function.pipe(...) on its own line when there are 2+ arguments",
        },
        fixable: "whitespace",
        schema: [],
        messages: {
          requireNewline: "Each argument of pipe(...) should be on its own line",
        },
      },
      create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode()

        function isPipeCall(node) {
          const callee = node.callee
          return (
            callee.type === "MemberExpression" &&
            !callee.computed &&
            callee.property.type === "Identifier" &&
            callee.property.name === "pipe"
          )
        }

        return {
          CallExpression(node) {
            if (!isPipeCall(node)) return
            if (node.arguments.length < 2) return

            const args = node.arguments
            const first = args[0]
            const openParen = sourceCode.getTokenAfter(node.callee)
            if (!openParen || openParen.value !== "(") return

            const indent = " ".repeat(node.loc.start.column + 2)

            if (openParen.loc.end.line === first.loc.start.line) {
              context.report({
                node: first,
                messageId: "requireNewline",
                fix: (fixer) =>
                  fixer.replaceTextRange(
                    [openParen.range[1], first.range[0]],
                    "\n" + indent,
                  ),
              })
            }

            for (let i = 1; i < args.length; i++) {
              const prev = args[i - 1]
              const curr = args[i]
              if (prev.loc.end.line !== curr.loc.start.line) continue
              const comma = sourceCode.getTokenAfter(prev)
              if (!comma || comma.value !== ",") continue
              context.report({
                node: curr,
                messageId: "requireNewline",
                fix: (fixer) =>
                  fixer.replaceTextRange(
                    [comma.range[1], curr.range[0]],
                    "\n" + indent,
                  ),
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
          description: "Enforce newlines between chained test assertion methods (test.expect().toBe())",
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
            if (
              current.type === "CallExpression" &&
              current.callee.type === "MemberExpression"
            ) {
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

          while (
            current.type === "CallExpression" &&
            current.callee.type === "MemberExpression"
          ) {
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
                return
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
                    return fixer.insertTextAfter(
                      sourceCode.getLastToken(prev),
                      "\n",
                    )
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
                    return fixer.insertTextAfter(
                      sourceCode.getLastToken(node),
                      "\n",
                    )
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

/**
 * Factories whose enclosing class or const name should match a string argument.
 *
 * `object`/`property` identify the `X.Y(...)` callee. `shape` says where the
 * string lives:
 *   - "call": direct argument of the factory call, e.g. Data.TaggedError("Tag")
 *   - "outer": Factory<Self>()("Tag", ...) — string on the outer of a double call
 *   - "inner": Factory<Self>("Id")(...) or Factory("Id")<...>() — string on the
 *     inner call (the factory's own call, which is the callee of the outer one)
 * `matchSegment` compares against the last "/"- or "."-segment of the string
 * instead of the whole string (namespaced identifiers like "effect-start/Routes").
 */
const taggedFactories = [
  { object: "Data", property: "TaggedError", shape: "call", kind: "tag" },
  { object: "Data", property: "TaggedClass", shape: "call", kind: "tag" },
  { object: "Request", property: "TaggedClass", shape: "call", kind: "tag" },
  { object: "Schema", property: "TaggedError", shape: "outer", kind: "tag" },
  { object: "Schema", property: "TaggedClass", shape: "outer", kind: "tag" },
  { object: "Schema", property: "TaggedRequest", shape: "outer", kind: "tag" },
  { object: "Schema", property: "TaggedStruct", shape: "call", kind: "tag" },
  { object: "Schema", property: "Class", shape: "inner", kind: "identifier" },
  { object: "Context", property: "Tag", shape: "inner", matchSegment: true },
  { object: "Context", property: "Reference", shape: "outer", matchSegment: true },
  { object: "Context", property: "GenericTag", shape: "call", matchSegment: true },
  { object: "Effect", property: "Tag", shape: "inner", matchSegment: true },
  { object: "Effect", property: "Service", shape: "outer", matchSegment: true },
]

/**
 * Track imports of a package's modules so rules match the module by binding,
 * not by a bare identifier name (a local `Effect`/`Schema` no longer matches).
 *
 * Resolves a local (possibly aliased) name to a canonical module name across:
 *   - submodule namespace:  import * as S from "effect/Schema"   -> S resolves to "Schema"
 *   - barrel named:         import { Schema as S } from "effect" -> S resolves to "Schema"
 *   - package namespace:    import * as test from "bun:test"     -> test resolves to "bun:test"
 *
 * Spread the returned `ImportDeclaration` into the rule's visitor object.
 */
function createImportTracker(pkg) {
  const local = new Map()
  const submodulePrefix = pkg + "/"

  return {
    ImportDeclaration(node) {
      const source = node.source.value
      if (typeof source !== "string") return

      if (source === pkg) {
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            local.set(specifier.local.name, pkg)
          } else if (specifier.type === "ImportSpecifier" && specifier.imported.type === "Identifier") {
            local.set(specifier.local.name, specifier.imported.name)
          }
        }
        return
      }

      if (source.startsWith(submodulePrefix)) {
        const canonical = source.slice(submodulePrefix.length)
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            local.set(specifier.local.name, canonical)
          }
        }
      }
    },
    moduleOf(node) {
      return node.type === "Identifier" ? local.get(node.name) : undefined
    },
    isMember(node, module, property) {
      const callee = node.type === "TSInstantiationExpression" ? node.expression : node
      return (
        callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        local.get(callee.object.name) === module &&
        callee.property.type === "Identifier" &&
        callee.property.name === property
      )
    },
  }
}

function matchesCallee(callee, factory, imports) {
  return imports.isMember(callee, factory.object, factory.property)
}

function getTaggedFactory(superClass, imports) {
  const outer = superClass.type === "TSInstantiationExpression"
    ? superClass.expression
    : superClass
  if (outer.type !== "CallExpression") return

  const inner = outer.callee.type === "CallExpression"
    ? outer.callee
    : outer.callee.type === "TSInstantiationExpression" &&
        outer.callee.expression.type === "CallExpression"
    ? outer.callee.expression
    : undefined

  for (const factory of taggedFactories) {
    if (factory.shape === "call") {
      if (!matchesCallee(outer.callee, factory, imports)) continue
      return { call: outer, argIndex: 0, ...factory }
    }
    if (!inner) continue
    if (factory.shape === "outer") {
      if (!matchesCallee(inner.callee, factory, imports)) continue
      return { call: outer, argIndex: 0, ...factory }
    }
    if (matchesCallee(inner.callee, factory, imports)) {
      return { call: inner, argIndex: 0, ...factory }
    }
  }
}

function checkTypeRef(context, node, imports) {
  const typeName = node.typeName
  if (typeName.type !== "TSQualifiedName") return
  if (typeName.right.type !== "Identifier" || typeName.right.name !== "Type") {
    return
  }

  const mid = typeName.left
  if (mid.type !== "TSQualifiedName") return
  if (mid.right.type !== "Identifier" || mid.right.name !== "Schema") return
  if (imports.moduleOf(mid.left) !== "Schema") return

  const args = node.typeArguments
  if (!args || args.params.length !== 1) return

  const param = args.params[0]
  if (param.type !== "TSTypeQuery") return

  const exprName = param.exprName
  if (exprName.type !== "Identifier") return

  const name = exprName.name

  context.report({
    node,
    messageId: "preferTypeof",
    data: { name },
    fix(fixer) {
      return fixer.replaceTextRange(node.range, "typeof " + name + ".Type")
    },
  })
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

function isLocalImport(source) {
  return source.startsWith(".") || source.startsWith("/")
}

function isCapitalized(name) {
  if (name.length > 0 && name[0] === "_") return isCapitalized(name.slice(1))
  return name.length > 0 && name[0] >= "A" && name[0] <= "Z"
}
