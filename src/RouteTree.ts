import * as PathPattern from "./PathPattern.ts"
import * as Route from "./Route.ts"

export interface Node {
  children: Record<string, Node>
  paramChild: Node | null
  paramName: string | null
  requiredWildcardChild: Node | null
  requiredWildcardName: string | null
  optionalWildcardChild: Node | null
  optionalWildcardName: string | null
  routes: Route.Route.Route[]
}

export interface RouteTree {
  readonly methods: Record<string, Node>
}

export interface LookupResult {
  route: Route.Route.Route
  params: Record<string, string>
}

function createNode(): Node {
  return {
    children: {},
    paramChild: null,
    paramName: null,
    requiredWildcardChild: null,
    requiredWildcardName: null,
    optionalWildcardChild: null,
    optionalWildcardName: null,
    routes: [],
  }
}

function insertRoute(
  node: Node,
  segments: string[],
  route: Route.Route.Route,
): void {
  if (segments.length === 0) {
    node.routes.push(route)
    return
  }

  const segment = segments[0]
  const rest = segments.slice(1)

  if (segment.startsWith(":")) {
    const name = segment.slice(1)

    if (name.endsWith("+")) {
      if (!node.requiredWildcardChild) {
        node.requiredWildcardChild = createNode()
      }
      node.requiredWildcardChild.requiredWildcardName = name.slice(0, -1)
      node.requiredWildcardChild.routes.push(route)
    } else if (name.endsWith("*")) {
      if (!node.optionalWildcardChild) {
        node.optionalWildcardChild = createNode()
      }
      node.optionalWildcardChild.optionalWildcardName = name.slice(0, -1)
      node.optionalWildcardChild.routes.push(route)
    } else if (name.endsWith("?")) {
      if (!node.paramChild) {
        node.paramChild = createNode()
      }
      node.paramChild.paramName = name.slice(0, -1)
      insertRoute(node.paramChild, rest, route)
      insertRoute(node, rest, route)
    } else {
      if (!node.paramChild) {
        node.paramChild = createNode()
      }
      node.paramChild.paramName = name
      insertRoute(node.paramChild, rest, route)
    }
  } else {
    if (!node.children[segment]) {
      node.children[segment] = createNode()
    }
    insertRoute(node.children[segment], rest, route)
  }
}

interface CollectedRoute {
  route: Route.Route.Route
  method: string
  path: string
}

function collectRoutes(
  items: Route.RouteSet.Tuple,
  parentPath: string,
  parentMethod: string,
): CollectedRoute[] {
  const results: CollectedRoute[] = []

  for (const item of items) {
    const desc = Route.descriptor(item) as { path?: string; method?: string }
    const currentPath = typeof desc?.path === "string"
      ? parentPath + desc.path
      : parentPath
    const currentMethod = desc?.method ?? parentMethod

    if (Route.isRoute(item)) {
      if (currentPath !== "") {
        results.push({
          route: item,
          method: currentMethod,
          path: currentPath,
        })
      }
    } else {
      const nestedItems = Route.items(item)
      results.push(...collectRoutes(nestedItems, currentPath, currentMethod))
    }
  }

  return results
}

export function make(set: Route.RouteSet.Any): RouteTree {
  const methods: Record<string, Node> = {}
  const collected = collectRoutes(Route.items(set), "", "*")

  for (const { route, method, path } of collected) {
    if (!methods[method]) {
      methods[method] = createNode()
    }
    const result = PathPattern.validate(path)
    if (!result.ok) {
      throw new Error(result.error)
    }
    insertRoute(methods[method], result.segments, route)
  }

  return { methods }
}

function lookupNode(
  node: Node,
  segments: string[],
  params: Record<string, string>,
): LookupResult[] {
  const results: LookupResult[] = []

  if (segments.length === 0) {
    for (const route of node.routes) {
      results.push({ route, params })
    }
    if (
      node.optionalWildcardChild
      && node.optionalWildcardChild.optionalWildcardName
    ) {
      for (const route of node.optionalWildcardChild.routes) {
        results.push({ route, params })
      }
    }
    return results
  }

  const segment = segments[0]
  const rest = segments.slice(1)

  if (node.children[segment]) {
    results.push(...lookupNode(node.children[segment], rest, params))
  }

  if (node.paramChild && node.paramChild.paramName) {
    const newParams = { ...params, [node.paramChild.paramName]: segment }
    results.push(...lookupNode(node.paramChild, rest, newParams))
  }

  if (
    node.requiredWildcardChild
    && node.requiredWildcardChild.requiredWildcardName
  ) {
    const wildcardValue = segments.join("/")
    const newParams = {
      ...params,
      [node.requiredWildcardChild.requiredWildcardName]: wildcardValue,
    }
    for (const route of node.requiredWildcardChild.routes) {
      results.push({ route, params: newParams })
    }
  }

  if (
    node.optionalWildcardChild
    && node.optionalWildcardChild.optionalWildcardName
  ) {
    const wildcardValue = segments.join("/")
    const newParams = {
      ...params,
      [node.optionalWildcardChild.optionalWildcardName]: wildcardValue,
    }
    for (const route of node.optionalWildcardChild.routes) {
      results.push({ route, params: newParams })
    }
  }

  return results
}

export function lookup(
  tree: RouteTree,
  method: string,
  path: string,
): LookupResult[] {
  const segments = path.split("/").filter(Boolean)
  const results: LookupResult[] = []

  if (tree.methods[method]) {
    results.push(...lookupNode(tree.methods[method], segments, {}))
  }

  if (method !== "*" && tree.methods["*"]) {
    results.push(...lookupNode(tree.methods["*"], segments, {}))
  }

  return results
}
