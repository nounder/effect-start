import * as HyperNode from "../../HyperNode.ts"

export const HyperHooks = {
  onNode,
} as const

function onNode(node: HyperNode.HyperNode) {
  const {
    "data-signals": dataSignals,
    "data-class": dataClass,
    "data-attr": dataAttr,
    "data-style": dataStyle,
    "data-show": dataShow,
    "data-ignore": dataIgnore,
    "data-ignore-morph": dataIgnoreMorph,
  } = node.props as any

  if (typeof dataSignals === "object" && dataSignals !== null) {
    node.props["data-signals"] = JSON.stringify(dataSignals)
  }

  if (typeof dataClass === "function") {
    node.props["data-class"] = `(${dataClass.toString()})()`
  } else if (typeof dataClass === "object" && dataClass !== null) {
    node.props["data-class"] = JSON.stringify(dataClass)
  }

  if (typeof dataAttr === "object" && dataAttr !== null) {
    node.props["data-attr"] = JSON.stringify(dataAttr)
  }

  if (typeof dataStyle === "function") {
    node.props["data-style"] = `(${dataStyle.toString()})()`
  } else if (typeof dataStyle === "object" && dataStyle !== null) {
    node.props["data-style"] = JSON.stringify(dataStyle)
  }

  if (typeof dataShow === "boolean") {
    node.props["data-show"] = dataShow.toString()
  }

  if (dataIgnore !== true && dataIgnore !== undefined) {
    delete node.props["data-ignore"]
  }

  if (dataIgnoreMorph !== true && dataIgnoreMorph !== undefined) {
    delete node.props["data-ignore-morph"]
  }

  // Handle dynamic attributes with suffixes
  for (const [key, value] of Object.entries(node.props)) {
    if (
      key.startsWith("data-signals-")
      && typeof value === "object"
      && value !== null
    ) {
      node.props[key] = JSON.stringify(value)
    }

    if (
      key.startsWith("data-on-")
      && typeof value === "function"
    ) {
      // @ts-ignore
      node.props[key] = `(${value.toString()})()`
    }
  }
}
