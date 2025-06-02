import * as FileRouter from "./FileRouter.ts"

export function generateCode(
  handles: FileRouter.OrderedRouteHandles,
): string {
  const definitions: string[] = []
  const layoutVariables = new Map<string, string>()
  const pageVariables: string[] = []

  for (const handle of handles) {
    const prefix = handle.type === "LayoutHandle" ? "layout" : "page"
    const normalizedPath = handle
      .routePath
      // remove leading slash
      .slice(1)
      // convert slashes to underscores
      .replace(/\//g, "_")
    const varName = `${prefix}_${normalizedPath}`

    switch (handle.type) {
      case "LayoutHandle": {
        // Find parent layout from previously processed layouts
        let parentLayoutVar: string | null = null
        let maxDepth = -1

        for (const [layoutPath, layoutVar] of layoutVariables) {
          if (
            layoutPath !== handle.routePath
            && handle.routePath.startsWith(layoutPath + "/")
            && layoutPath.length > maxDepth
          ) {
            parentLayoutVar = layoutVar
            maxDepth = layoutPath.length
          }
        }

        const code = `const ${varName} = {
\tpath: "${handle.routePath}",
\tlayout: ${parentLayoutVar ?? "undefined"},
\tload: () => import("./${handle.modulePath}"),
}`

        definitions.push(code)
        layoutVariables.set(handle.routePath, varName)

        break
      }
      case "PageHandle": {
        // Find layout for this page from previously processed layouts
        let layoutVar: string | null = null
        let maxDepth = -1

        for (const [layoutPath, layoutVarName] of layoutVariables) {
          // Check for exact match first
          if (layoutPath === handle.routePath) {
            layoutVar = layoutVarName
            break
          }

          // Then check for parent layout
          const isParent = handle.routePath.startsWith(layoutPath + "/")
            || (layoutPath === "/" && handle.routePath !== "/")

          if (isParent && layoutPath.length > maxDepth) {
            layoutVar = layoutVarName
            maxDepth = layoutPath.length
          }
        }

        const code = `const ${varName} = {
  path: "${handle.routePath}",
  layout: ${layoutVar ?? "undefined"},
  load: () => import("./${handle.modulePath}"),
}`

        definitions.push(code)
        pageVariables.push(varName)

        break
      }
    }
  }

  return `${definitions.join("\n")}

export const Pages = [
\t${pageVariables.join(",\n")}
] as const
 `
    .replace(/\t/g, "  ")
}
