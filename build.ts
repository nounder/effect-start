import * as NPath from "node:path"
import * as NFs from "node:fs"
import {
  Project,
  Node,
  SyntaxKind,
  type SourceFile,
  type FunctionDeclaration,
  type ParameterDeclaration,
  type VariableStatement,
  type ClassDeclaration,
} from "ts-morph"

type Edit =
  | { kind: "remove"; start: number; end: number }
  | { kind: "replace"; start: number; end: number; text: string }
  | { kind: "insertBefore"; position: number; text: string }

interface Args {
  glob: string
  dryRun: boolean
  watch: boolean
  exports: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  let glob = "src/**/*.ts"
  let dryRun = false
  let watch = false
  let exports_ = false

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true
    else if (arg === "--watch") watch = true
    else if (arg === "--exports") exports_ = true
    else if (!arg.startsWith("-")) glob = arg
  }

  return { glob, dryRun, watch, exports: exports_ }
}

function rewriteImportPath(specifier: string): string {
  if (specifier.startsWith(".") && specifier.endsWith(".ts")) {
    return specifier.slice(0, -3) + ".js"
  }
  return specifier
}

function isThisParam(param: ParameterDeclaration): boolean {
  return param.getName() === "this"
}

function isTypeOnlyNamespace(node: Node): boolean {
  if (!Node.isModuleDeclaration(node)) return false
  const body = node.getBody()
  if (!body || !Node.isModuleBlock(body)) return false
  for (const stmt of body.getStatements()) {
    if (Node.isInterfaceDeclaration(stmt)) continue
    if (Node.isTypeAliasDeclaration(stmt)) continue
    if (Node.isModuleDeclaration(stmt) && isTypeOnlyNamespace(stmt)) continue
    if (Node.isExportDeclaration(stmt)) {
      if (stmt.isTypeOnly()) continue
    }
    return false
  }
  return true
}

function isImplementationSignature(func: FunctionDeclaration): boolean {
  return func.hasBody()
}

function collectEdits(sourceFile: SourceFile): Array<Edit> {
  const edits: Array<Edit> = []
  const text = sourceFile.getFullText()

  for (const stmt of sourceFile.getStatements()) {
    if (Node.isImportDeclaration(stmt)) {
      handleImportDeclaration(stmt, edits, text)
      continue
    }

    if (Node.isExportDeclaration(stmt)) {
      handleExportDeclaration(stmt, edits, text)
      continue
    }

    if (Node.isInterfaceDeclaration(stmt)) {
      removeStatement(stmt, edits, text)
      continue
    }

    if (Node.isTypeAliasDeclaration(stmt)) {
      removeStatement(stmt, edits, text)
      continue
    }

    if (Node.isModuleDeclaration(stmt) && isTypeOnlyNamespace(stmt)) {
      removeStatement(stmt, edits, text)
      continue
    }

    if (Node.isFunctionDeclaration(stmt)) {
      handleFunctionDeclaration(stmt, edits, text)
      continue
    }

    if (Node.isVariableStatement(stmt)) {
      handleVariableStatement(stmt, edits, text)
      continue
    }

    if (Node.isClassDeclaration(stmt)) {
      handleClassDeclaration(stmt, edits, text)
      continue
    }

    if (Node.isExportAssignment(stmt)) {
      handleExpression(stmt.getExpression(), edits, text)
      continue
    }

    if (Node.isExpressionStatement(stmt)) {
      handleExpression(stmt.getExpression(), edits, text)
      continue
    }
  }

  return edits
}

function handleImportDeclaration(decl: Node, edits: Array<Edit>, text: string): void {
  if (!Node.isImportDeclaration(decl)) return

  if (decl.isTypeOnly()) {
    removeStatement(decl, edits, text)
    return
  }

  const moduleSpecifier = decl.getModuleSpecifierValue()
  if (moduleSpecifier.startsWith(".") && moduleSpecifier.endsWith(".ts")) {
    const specNode = decl.getModuleSpecifier()
    const newPath = rewriteImportPath(moduleSpecifier)
    edits.push({
      kind: "replace",
      start: specNode.getStart() + 1,
      end: specNode.getEnd() - 1,
      text: newPath,
    })
  }

  const namedImports = decl.getNamedImports()
  if (namedImports.length > 0) {
    const typeOnlySpecifiers = namedImports.filter((s) => s.isTypeOnly())
    if (typeOnlySpecifiers.length === namedImports.length) {
      if (!decl.getDefaultImport() && !decl.getNamespaceImport()) {
        removeStatement(decl, edits, text)
        return
      }
    }

    removeTypeOnlySpecifiers(typeOnlySpecifiers, namedImports, edits, text)
  }
}

function removeTypeOnlySpecifiers(
  typeOnly: Array<Node>,
  allSpecifiers: Array<Node>,
  edits: Array<Edit>,
  text: string,
): void {
  const removing = new Set(typeOnly)

  for (const specifier of typeOnly) {
    const idx = allSpecifiers.indexOf(specifier)
    let start = specifier.getStart()
    let end = specifier.getEnd()

    if (allSpecifiers.length === 1) {
      const parent = specifier.getParent()
      if (parent) {
        start = parent.getStart()
        end = parent.getEnd()
        const prevText = text.slice(Math.max(0, start - 3), start)
        if (prevText.trimEnd().endsWith(",")) {
          start = start - prevText.length + prevText.lastIndexOf(",")
        }
      }
    } else if (idx < allSpecifiers.length - 1 && !removing.has(allSpecifiers[idx + 1])) {
      // Next specifier exists and will remain — extend to eat trailing comma/whitespace
      const nextStart = allSpecifiers[idx + 1].getStart()
      end = nextStart
    } else if (idx < allSpecifiers.length - 1) {
      // Next specifier also being removed — skip, it will be covered by a later edit
      continue
    } else {
      // Last specifier — find the nearest preceding specifier that will remain
      let prevIdx = idx - 1
      while (prevIdx >= 0 && removing.has(allSpecifiers[prevIdx])) {
        prevIdx--
      }
      const anchorEnd = prevIdx >= 0 ? allSpecifiers[prevIdx].getEnd() : allSpecifiers[0].getStart()
      const between = text.slice(anchorEnd, start)
      const commaIdx = between.indexOf(",")
      if (commaIdx !== -1) {
        start = anchorEnd + commaIdx
      }
    }

    edits.push({ kind: "remove", start, end })
  }
}

function handleExportDeclaration(decl: Node, edits: Array<Edit>, text: string): void {
  if (!Node.isExportDeclaration(decl)) return

  if (decl.isTypeOnly()) {
    removeStatement(decl, edits, text)
    return
  }

  const moduleSpecifier = decl.getModuleSpecifierValue()
  if (moduleSpecifier && moduleSpecifier.startsWith(".") && moduleSpecifier.endsWith(".ts")) {
    const specNode = decl.getModuleSpecifier()
    if (specNode) {
      const newPath = rewriteImportPath(moduleSpecifier)
      edits.push({
        kind: "replace",
        start: specNode.getStart() + 1,
        end: specNode.getEnd() - 1,
        text: newPath,
      })
    }
  }

  const namedExports = decl.getNamedExports()
  if (namedExports.length > 0) {
    const typeOnlySpecifiers = namedExports.filter((s) => s.isTypeOnly())
    if (typeOnlySpecifiers.length === namedExports.length) {
      removeStatement(decl, edits, text)
      return
    }
    removeTypeOnlySpecifiers(typeOnlySpecifiers, namedExports, edits, text)
  }
}

function handleFunctionDeclaration(
  func: FunctionDeclaration,
  edits: Array<Edit>,
  text: string,
): void {
  if (!func.getName()) return
  if (!isImplementationSignature(func)) return

  // Remove overload signatures
  for (const overload of func.getOverloads()) {
    removeStatement(overload, edits, text)
  }

  stripFunctionTypes(func, edits, text)
}

function stripFunctionTypes(func: FunctionDeclaration, edits: Array<Edit>, text: string): void {
  stripTypeParameters(func.getTypeParameters(), edits, text)

  const returnType = func.getReturnTypeNode()
  if (returnType) {
    const colonPos = text.lastIndexOf(":", returnType.getStart())
    if (colonPos !== -1) {
      edits.push({ kind: "remove", start: colonPos, end: returnType.getEnd() })
    }
  }

  for (const param of func.getParameters()) {
    stripParameterTypes(param, edits, text)
  }

  const body = func.getBody()
  if (body) {
    walkExpressions(body, edits, text)
  }
}

function stripTypeParameters(
  typeParams: ReadonlyArray<Node>,
  edits: Array<Edit>,
  text: string,
): void {
  if (typeParams.length === 0) return
  const first = typeParams[0]
  const last = typeParams[typeParams.length - 1]
  const ltPos = text.lastIndexOf("<", first.getStart())
  const gtPos = text.indexOf(">", last.getEnd())
  if (ltPos !== -1 && gtPos !== -1) {
    edits.push({ kind: "remove", start: ltPos, end: gtPos + 1 })
  }
}

function stripParameterTypes(param: ParameterDeclaration, edits: Array<Edit>, text: string): void {
  if (isThisParam(param)) {
    removeThisParam(param, edits, text)
    return
  }

  const questionToken = param.getQuestionTokenNode()
  if (questionToken) {
    edits.push({
      kind: "remove",
      start: questionToken.getStart(),
      end: questionToken.getEnd(),
    })
  }

  const typeNode = param.getTypeNode()
  if (typeNode) {
    const colonPos = text.lastIndexOf(":", typeNode.getStart())
    if (colonPos !== -1 && colonPos >= param.getNameNode().getEnd()) {
      edits.push({ kind: "remove", start: colonPos, end: typeNode.getEnd() })
    }
  }

  const initializer = param.getInitializer()
  if (initializer) {
    handleExpression(initializer, edits, text)
  }
}

function removeThisParam(param: ParameterDeclaration, edits: Array<Edit>, text: string): void {
  const start = param.getStart()
  let end = param.getEnd()

  const afterParam = text.slice(end, end + 10)
  const commaMatch = afterParam.match(/^,\s*/)
  if (commaMatch) {
    end += commaMatch[0].length
  }

  edits.push({ kind: "remove", start, end })
}

function handleVariableStatement(stmt: VariableStatement, edits: Array<Edit>, text: string): void {
  for (const decl of stmt.getDeclarations()) {
    const typeNode = decl.getTypeNode()
    const initializer = decl.getInitializer()

    if (typeNode) {
      const colonPos = text.lastIndexOf(":", typeNode.getStart())
      if (colonPos !== -1 && colonPos >= decl.getNameNode().getEnd()) {
        edits.push({ kind: "remove", start: colonPos, end: typeNode.getEnd() })
      }
    }

    if (initializer) {
      handleExpression(initializer, edits, text)
    }
  }
}

function handleClassDeclaration(cls: ClassDeclaration, edits: Array<Edit>, text: string): void {
  stripTypeParameters(cls.getTypeParameters(), edits, text)

  const extendsClause = cls.getExtends()
  if (extendsClause) {
    handleExtendsExpression(extendsClause, edits, text)
  }

  // Strip `implements` clause
  const implementsArr = cls.getImplements()
  if (implementsArr.length > 0) {
    const last = implementsArr[implementsArr.length - 1]
    const classText = text.slice(cls.getStart(), last.getEnd())
    const implementsIdx = classText.lastIndexOf("implements")
    if (implementsIdx !== -1) {
      const absStart = cls.getStart() + implementsIdx
      let wsStart = absStart
      while (wsStart > 0 && text[wsStart - 1] === " ") wsStart--
      edits.push({ kind: "remove", start: wsStart, end: last.getEnd() })
    }
  }

  for (const member of cls.getMembers()) {
    if (Node.isPropertyDeclaration(member)) {
      handleClassProperty(member, edits, text)
    } else if (Node.isMethodDeclaration(member)) {
      handleClassMethod(member, edits, text)
    } else if (Node.isConstructorDeclaration(member)) {
      for (const param of member.getParameters()) {
        stripParameterTypes(param, edits, text)
      }
      const returnType = member.getReturnTypeNode()
      if (returnType) {
        const colonPos = text.lastIndexOf(":", returnType.getStart())
        if (colonPos !== -1) {
          edits.push({
            kind: "remove",
            start: colonPos,
            end: returnType.getEnd(),
          })
        }
      }
      const body = member.getBody()
      if (body) {
        walkExpressions(body, edits, text)
      }
    } else if (Node.isGetAccessorDeclaration(member) || Node.isSetAccessorDeclaration(member)) {
      const returnType = member.getReturnTypeNode()
      if (returnType) {
        const colonPos = text.lastIndexOf(":", returnType.getStart())
        if (colonPos !== -1) {
          edits.push({
            kind: "remove",
            start: colonPos,
            end: returnType.getEnd(),
          })
        }
      }
      for (const param of member.getParameters()) {
        stripParameterTypes(param, edits, text)
      }
      const body = member.getBody()
      if (body) {
        walkExpressions(body, edits, text)
      }
    }
  }
}

function handleExtendsExpression(extendsExpr: Node, edits: Array<Edit>, text: string): void {
  if (Node.isExpressionWithTypeArguments(extendsExpr)) {
    const typeArgs = extendsExpr.getTypeArguments()
    if (typeArgs.length > 0) {
      stripTypeArguments(extendsExpr, edits, text)
    }
  }

  extendsExpr.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const typeArgs = node.getTypeArguments()
      if (typeArgs.length > 0) {
        stripTypeArguments(node, edits, text)
      }
    }
  })
}

function handleClassProperty(prop: Node, edits: Array<Edit>, text: string): void {
  if (!Node.isPropertyDeclaration(prop)) return

  for (const kind of [
    SyntaxKind.ReadonlyKeyword,
    SyntaxKind.PrivateKeyword,
    SyntaxKind.ProtectedKeyword,
    SyntaxKind.OverrideKeyword,
    SyntaxKind.AbstractKeyword,
    SyntaxKind.DeclareKeyword,
  ]) {
    const modifier = prop.getModifiers().find((m) => m.getKind() === kind)
    if (modifier) {
      let end = modifier.getEnd()
      if (text[end] === " ") end++
      edits.push({ kind: "remove", start: modifier.getStart(), end })
    }
  }

  const typeNode = prop.getTypeNode()
  if (typeNode) {
    const colonPos = text.lastIndexOf(":", typeNode.getStart())
    if (colonPos !== -1 && colonPos >= prop.getNameNode().getEnd()) {
      edits.push({ kind: "remove", start: colonPos, end: typeNode.getEnd() })
    }
  }

  const initializer = prop.getInitializer()
  if (initializer) {
    handleExpression(initializer, edits, text)
  }
}

function handleClassMethod(method: Node, edits: Array<Edit>, text: string): void {
  if (!Node.isMethodDeclaration(method)) return

  for (const kind of [
    SyntaxKind.PrivateKeyword,
    SyntaxKind.ProtectedKeyword,
    SyntaxKind.OverrideKeyword,
    SyntaxKind.AbstractKeyword,
  ]) {
    const modifier = method.getModifiers().find((m) => m.getKind() === kind)
    if (modifier) {
      let end = modifier.getEnd()
      if (text[end] === " ") end++
      edits.push({ kind: "remove", start: modifier.getStart(), end })
    }
  }

  stripTypeParameters(method.getTypeParameters(), edits, text)

  const returnType = method.getReturnTypeNode()
  if (returnType) {
    const colonPos = text.lastIndexOf(":", returnType.getStart())
    if (colonPos !== -1) {
      edits.push({ kind: "remove", start: colonPos, end: returnType.getEnd() })
    }
  }

  for (const param of method.getParameters()) {
    stripParameterTypes(param, edits, text)
  }

  const body = method.getBody()
  if (body) {
    walkExpressions(body, edits, text)
  }
}

function handleExpression(expr: Node, edits: Array<Edit>, text: string): void {
  if (!expr) return

  // `as const` → `/** @type {const} */`
  if (Node.isAsExpression(expr)) {
    const typeNode = expr.getTypeNode()
    if (typeNode) {
      const typeText = typeNode.getText()
      if (typeText === "const") {
        const asKeywordPos = text.lastIndexOf(" as ", expr.getEnd())
        if (asKeywordPos !== -1 && asKeywordPos >= expr.getExpression().getEnd()) {
          edits.push({
            kind: "remove",
            start: asKeywordPos,
            end: expr.getEnd(),
          })
          edits.push({
            kind: "insertBefore",
            position: expr.getStart(),
            text: "/** @type {const} */ ",
          })
        }
        handleExpression(expr.getExpression(), edits, text)
        return
      }

      // All other type assertions: remove `as Type`
      const innerEnd = expr.getExpression().getEnd()
      edits.push({ kind: "remove", start: innerEnd, end: expr.getEnd() })
      handleExpression(expr.getExpression(), edits, text)
      return
    }
  }

  if (Node.isSatisfiesExpression(expr)) {
    const innerEnd = expr.getExpression().getEnd()
    edits.push({ kind: "remove", start: innerEnd, end: expr.getEnd() })
    handleExpression(expr.getExpression(), edits, text)
    return
  }

  if (Node.isTypeAssertion(expr)) {
    const typeNode = expr.getTypeNode()
    if (typeNode) {
      const ltPos = text.lastIndexOf("<", typeNode.getStart())
      const gtPos = text.indexOf(">", typeNode.getEnd())
      if (ltPos !== -1 && gtPos !== -1) {
        edits.push({ kind: "remove", start: ltPos, end: gtPos + 1 })
      }
    }
    handleExpression(expr.getExpression(), edits, text)
    return
  }

  if (Node.isNonNullExpression(expr)) {
    const innerEnd = expr.getExpression().getEnd()
    edits.push({ kind: "remove", start: innerEnd, end: expr.getEnd() })
    handleExpression(expr.getExpression(), edits, text)
    return
  }

  if (Node.isCallExpression(expr)) {
    const typeArgs = expr.getTypeArguments()
    if (typeArgs.length > 0) {
      stripTypeArguments(expr, edits, text)
    }
    handleExpression(expr.getExpression(), edits, text)
    for (const arg of expr.getArguments()) {
      handleExpression(arg, edits, text)
    }
    return
  }

  if (Node.isArrowFunction(expr)) {
    handleArrowFunction(expr, edits, text)
    return
  }

  if (Node.isFunctionExpression(expr)) {
    handleFunctionExpression(expr, edits, text)
    return
  }

  if (Node.isObjectLiteralExpression(expr)) {
    for (const prop of expr.getProperties()) {
      if (Node.isPropertyAssignment(prop)) {
        const init = prop.getInitializer()
        if (init) handleExpression(init, edits, text)
      } else if (Node.isMethodDeclaration(prop)) {
        handleClassMethod(prop, edits, text)
      } else if (Node.isGetAccessorDeclaration(prop) || Node.isSetAccessorDeclaration(prop)) {
        const returnType = prop.getReturnTypeNode()
        if (returnType) {
          const colonPos = text.lastIndexOf(":", returnType.getStart())
          if (colonPos !== -1) {
            edits.push({
              kind: "remove",
              start: colonPos,
              end: returnType.getEnd(),
            })
          }
        }
        for (const param of prop.getParameters()) {
          stripParameterTypes(param, edits, text)
        }
        const body = prop.getBody()
        if (body) walkExpressions(body, edits, text)
      } else if (Node.isSpreadAssignment(prop)) {
        handleExpression(prop.getExpression(), edits, text)
      }
    }
    return
  }

  if (Node.isArrayLiteralExpression(expr)) {
    for (const el of expr.getElements()) {
      handleExpression(el, edits, text)
    }
    return
  }

  if (Node.isParenthesizedExpression(expr)) {
    handleExpression(expr.getExpression(), edits, text)
    return
  }

  if (Node.isTemplateExpression(expr)) {
    for (const span of expr.getTemplateSpans()) {
      handleExpression(span.getExpression(), edits, text)
    }
    return
  }

  if (Node.isConditionalExpression(expr)) {
    handleExpression(expr.getCondition(), edits, text)
    handleExpression(expr.getWhenTrue(), edits, text)
    handleExpression(expr.getWhenFalse(), edits, text)
    return
  }

  if (Node.isBinaryExpression(expr)) {
    handleExpression(expr.getLeft(), edits, text)
    handleExpression(expr.getRight(), edits, text)
    return
  }

  if (Node.isPropertyAccessExpression(expr)) {
    handleExpression(expr.getExpression(), edits, text)
    return
  }

  if (Node.isElementAccessExpression(expr)) {
    handleExpression(expr.getExpression(), edits, text)
    handleExpression(expr.getArgumentExpression()!, edits, text)
    return
  }

  if (Node.isNewExpression(expr)) {
    const typeArgs = expr.getTypeArguments()
    if (typeArgs.length > 0) {
      stripTypeArguments(expr, edits, text)
    }
    handleExpression(expr.getExpression(), edits, text)
    for (const arg of expr.getArguments()) {
      handleExpression(arg, edits, text)
    }
    return
  }

  if (Node.isTaggedTemplateExpression(expr)) {
    handleExpression(expr.getTag(), edits, text)
    handleExpression(expr.getTemplate(), edits, text)
    return
  }

  if (Node.isSpreadElement(expr)) {
    handleExpression(expr.getExpression(), edits, text)
    return
  }

  if (Node.isAwaitExpression(expr)) {
    handleExpression(expr.getExpression(), edits, text)
    return
  }

  if (Node.isPrefixUnaryExpression(expr)) {
    handleExpression(expr.getOperand(), edits, text)
    return
  }

  if (Node.isYieldExpression(expr)) {
    const yieldExpr = expr.getExpression()
    if (yieldExpr) handleExpression(yieldExpr, edits, text)
    return
  }

  if (Node.isCommaListExpression(expr)) {
    for (const el of expr.getElements()) {
      handleExpression(el, edits, text)
    }
    return
  }
}

function stripTypeArguments(parent: Node, edits: Array<Edit>, _text: string): void {
  const children = parent.getChildren()
  const ltToken = children.find((c) => c.getKind() === SyntaxKind.LessThanToken)
  const gtToken = children.find((c) => c.getKind() === SyntaxKind.GreaterThanToken)
  if (ltToken && gtToken) {
    edits.push({
      kind: "remove",
      start: ltToken.getStart(),
      end: gtToken.getEnd(),
    })
  }
}

function handleArrowFunction(arrow: Node, edits: Array<Edit>, text: string): void {
  if (!Node.isArrowFunction(arrow)) return

  stripTypeParameters(arrow.getTypeParameters(), edits, text)

  const returnType = arrow.getReturnTypeNode()
  if (returnType) {
    const colonPos = text.lastIndexOf(":", returnType.getStart())
    const params = arrow.getParameters()
    const parenEnd = params.length > 0 ? params[params.length - 1].getEnd() : arrow.getStart()
    if (colonPos !== -1 && colonPos > parenEnd) {
      edits.push({ kind: "remove", start: colonPos, end: returnType.getEnd() })
    }
  }

  for (const param of arrow.getParameters()) {
    stripParameterTypes(param, edits, text)
  }

  const body = arrow.getBody()
  if (Node.isBlock(body)) {
    walkExpressions(body, edits, text)
  } else {
    handleExpression(body, edits, text)
  }
}

function handleFunctionExpression(func: Node, edits: Array<Edit>, text: string): void {
  if (!Node.isFunctionExpression(func)) return

  stripTypeParameters(func.getTypeParameters(), edits, text)

  const returnType = func.getReturnTypeNode()
  if (returnType) {
    const colonPos = text.lastIndexOf(":", returnType.getStart())
    if (colonPos !== -1) {
      edits.push({ kind: "remove", start: colonPos, end: returnType.getEnd() })
    }
  }

  for (const param of func.getParameters()) {
    stripParameterTypes(param, edits, text)
  }

  const body = func.getBody()
  if (body) {
    walkExpressions(body, edits, text)
  }
}

function walkExpressions(block: Node, edits: Array<Edit>, text: string): void {
  block.forEachDescendant((node, traversal) => {
    if (Node.isTypeAliasDeclaration(node) || Node.isInterfaceDeclaration(node)) {
      removeStatement(node, edits, text)
      traversal.skip()
      return
    }

    if (
      Node.isFunctionDeclaration(node) ||
      Node.isArrowFunction(node) ||
      Node.isFunctionExpression(node) ||
      Node.isClassDeclaration(node)
    ) {
      traversal.skip()
      if (Node.isFunctionDeclaration(node)) {
        handleFunctionDeclaration(node, edits, text)
      } else if (Node.isArrowFunction(node)) {
        handleArrowFunction(node, edits, text)
      } else if (Node.isFunctionExpression(node)) {
        handleFunctionExpression(node, edits, text)
      } else if (Node.isClassDeclaration(node)) {
        handleClassDeclaration(node, edits, text)
      }
      return
    }

    if (Node.isObjectLiteralExpression(node)) {
      traversal.skip()
      handleExpression(node, edits, text)
      return
    }

    if (Node.isVariableDeclaration(node)) {
      const typeNode = node.getTypeNode()
      if (typeNode) {
        const colonPos = text.lastIndexOf(":", typeNode.getStart())
        if (colonPos !== -1 && colonPos >= node.getNameNode().getEnd()) {
          edits.push({
            kind: "remove",
            start: colonPos,
            end: typeNode.getEnd(),
          })
        }
      }
      return
    }

    if (Node.isAsExpression(node)) {
      traversal.skip()
      handleExpression(node, edits, text)
      return
    }

    if (Node.isSatisfiesExpression(node)) {
      traversal.skip()
      handleExpression(node, edits, text)
      return
    }

    if (Node.isTypeAssertion(node)) {
      traversal.skip()
      handleExpression(node, edits, text)
      return
    }

    if (Node.isNonNullExpression(node)) {
      traversal.skip()
      handleExpression(node, edits, text)
      return
    }

    if (Node.isCallExpression(node)) {
      traversal.skip()
      handleExpression(node, edits, text)
      return
    }

    if (Node.isNewExpression(node)) {
      traversal.skip()
      handleExpression(node, edits, text)
      return
    }
  })
}

function removeStatement(node: Node, edits: Array<Edit>, text: string): void {
  let start = node.getStart()
  let end = node.getEnd()

  const lineStart = text.lastIndexOf("\n", start - 1) + 1
  if (text.slice(lineStart, start).trim() === "") {
    start = lineStart
  }

  if (text[end] === "\n") {
    end++
  } else if (text[end] === "\r" && text[end + 1] === "\n") {
    end += 2
  }

  edits.push({ kind: "remove", start, end })
}

function applyEdits(source: string, edits: Array<Edit>): string {
  const seen = new Set<string>()
  const unique: Array<Edit> = []
  for (const edit of edits) {
    const pos = edit.kind === "insertBefore" ? edit.position : edit.start
    const end = edit.kind === "insertBefore" ? edit.position : edit.end
    const key = `${edit.kind}:${pos}:${end}:${"text" in edit ? edit.text : ""}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(edit)
    }
  }

  unique.sort((a, b) => {
    const posA = a.kind === "insertBefore" ? a.position : a.start
    const posB = b.kind === "insertBefore" ? b.position : b.start
    if (posB !== posA) return posB - posA
    if (a.kind === "insertBefore" && b.kind !== "insertBefore") return -1
    if (b.kind === "insertBefore" && a.kind !== "insertBefore") return 1
    return 0
  })

  let result = source
  for (const edit of unique) {
    switch (edit.kind) {
      case "remove":
        result = result.slice(0, edit.start) + result.slice(edit.end)
        break
      case "replace":
        result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
        break
      case "insertBefore":
        result = result.slice(0, edit.position) + edit.text + result.slice(edit.position)
        break
    }
  }

  return result
}

function isTypeOnlyFile(sourceFile: SourceFile): boolean {
  for (const stmt of sourceFile.getStatements()) {
    if (Node.isImportDeclaration(stmt)) continue
    if (Node.isInterfaceDeclaration(stmt)) continue
    if (Node.isTypeAliasDeclaration(stmt)) continue
    if (Node.isModuleDeclaration(stmt) && isTypeOnlyNamespace(stmt)) continue
    if (Node.isExportDeclaration(stmt) && stmt.isTypeOnly()) continue
    return false
  }
  return true
}

function transformFile(sourceFile: SourceFile): { path: string; content: string } | null {
  if (isTypeOnlyFile(sourceFile)) return null

  const edits = collectEdits(sourceFile)
  let content = applyEdits(sourceFile.getFullText(), edits)

  // Clean up excessive blank lines (3+ → 2)
  content = content.replace(/\n{3,}/g, "\n\n")

  const tsPath = sourceFile.getFilePath()
  const cwd = process.cwd()
  const relPath = NPath.relative(NPath.resolve(cwd, "src"), tsPath)
  const jsPath = NPath.resolve(cwd, "dist", relPath.replace(/\.ts$/, ".js"))

  return { path: jsPath, content }
}

const EXCLUDE_PATTERNS = ["*.test.ts", "*.test.tsx", "*.d.ts", "*.todo.ts"]

function shouldExclude(filePath: string): boolean {
  const basename = NPath.basename(filePath)
  return EXCLUDE_PATTERNS.some((pattern) => {
    const ext = pattern.replace("*", "")
    return basename.endsWith(ext)
  })
}

async function processGlob(args: Args): Promise<void> {
  const project = new Project({
    tsConfigFilePath: NPath.resolve("tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  })

  const glob = new Bun.Glob(args.glob)
  const files = Array.from(glob.scanSync({ cwd: process.cwd(), absolute: true })).filter(
    (f) => f.endsWith(".ts") && !shouldExclude(f),
  )

  if (files.length === 0) {
    console.log("No matching .ts files found")
    return
  }

  const distDir = NPath.resolve("dist")
  if (!args.dryRun) {
    NFs.rmSync(distDir, { recursive: true, force: true })
  }

  for (const file of files) {
    project.addSourceFileAtPath(file)
  }

  let count = 0

  for (const sourceFile of project.getSourceFiles()) {
    const result = transformFile(sourceFile)
    if (!result) {
      console.log(`skip ${NPath.relative(process.cwd(), sourceFile.getFilePath())} (type-only)`)
      continue
    }

    const relPath = NPath.relative(process.cwd(), result.path)
    if (args.dryRun) {
      console.log(`\n--- ${relPath} ---`)
      console.log(result.content)
      count++
    } else {
      NFs.mkdirSync(NPath.dirname(result.path), { recursive: true })
      await Bun.write(result.path, result.content)
      console.log(`wrote ${relPath}`)
      count++
    }
  }

  console.log(`\n${count} file(s) ${args.dryRun ? "would be" : ""} written`)
}

async function watchMode(args: Args): Promise<void> {
  const project = new Project({
    tsConfigFilePath: NPath.resolve("tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  })

  const srcDir = NPath.resolve(NPath.dirname(args.glob.split("*")[0] || "src"))

  console.log(`Watching ${srcDir} for .ts changes...`)

  const watcher = NFs.watch(srcDir, { recursive: true }, async (_event, filename) => {
    if (!filename || !filename.endsWith(".ts") || shouldExclude(filename)) return

    const fullPath = NPath.resolve(srcDir, filename)
    if (!NFs.existsSync(fullPath)) return

    try {
      const existing = project.getSourceFile(fullPath)
      if (existing) {
        existing.refreshFromFileSystemSync()
      } else {
        project.addSourceFileAtPath(fullPath)
      }

      const sourceFile = project.getSourceFileOrThrow(fullPath)
      const result = transformFile(sourceFile)
      if (!result) {
        console.log(`skip ${filename} (type-only)`)
        return
      }

      NFs.mkdirSync(NPath.dirname(result.path), { recursive: true })
      await Bun.write(result.path, result.content)
      console.log(`wrote ${NPath.relative(process.cwd(), result.path)}`)
    } catch (err) {
      console.error(`Error processing ${filename}:`, err)
    }
  })

  process.on("SIGINT", () => {
    watcher.close()
    process.exit(0)
  })

  await processGlob({ ...args, watch: false })
}

async function updateExports(): Promise<void> {
  const pkgPath = NPath.resolve("package.json")
  const pkg = JSON.parse(NFs.readFileSync(pkgPath, "utf-8"))
  const exports = pkg.exports

  if (!exports || typeof exports !== "object") {
    console.log("No exports field in package.json")
    return
  }

  let hasErrors = false

  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === "string") {
      if (!value.includes("*") && !NFs.existsSync(NPath.resolve(value))) {
        console.error(`missing: ${value} (${key})`)
        hasErrors = true
      }
      continue
    }
    const entry = value as Record<string, string>
    if (!entry.default) continue

    const srcMatch = entry.default.match(/^\.\/src\/(.+)\.js$/)
    if (srcMatch) {
      entry.default = `./dist/${srcMatch[1]}.js`
    }

    for (const [condition, path] of Object.entries(entry)) {
      if (path.includes("*")) continue
      if (!NFs.existsSync(NPath.resolve(path))) {
        console.error(`missing: ${path} (${key} → ${condition})`)
        hasErrors = true
      }
    }
  }

  if (hasErrors) {
    process.exitCode = 1
  }

  const content = JSON.stringify(pkg, null, 2) + "\n"
  NFs.writeFileSync(pkgPath, content)
  console.log("Updated exports in package.json")
}

const args = parseArgs()
if (args.exports) {
  await updateExports()
} else if (args.watch) {
  await watchMode(args)
} else {
  await processGlob(args)
}
