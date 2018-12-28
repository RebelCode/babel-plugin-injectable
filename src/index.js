/**
 * Get injectable name and match.
 *
 * @param string
 *
 * @return {*}
 */
function getInjectable (string) {
  const match = /@injectable\s?([a-zA-Z0-9]*)?/gm.exec(string)
  if (!match) {
    return false
  }
  return match[1] || true
}

/**
 * Append injections to the given path.
 *
 * @param t
 * @param path Path for appending.
 * @param fnNode Node for retrieving parameters.
 * @param id Instance name.
 * @param {boolean|string} injectable Whether instance should be injectable.
 */
function appendInjectionExpressions (t, path, fnNode, id, injectable) {
  let isClass = false

  if (fnNode.body && fnNode.body.type === 'ClassBody') {
    fnNode = fnNode.body.body.find(node => node.kind === 'constructor')
    if (!fnNode) {
      fnNode = {params: []}
    }
    isClass = true
  }

  if (!fnNode || !Array.isArray(fnNode.params)) {
    return
  }
  // a.$injectable = true
  path.insertAfter(t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(
        id,
        t.identifier('$injectable')
      ),
      t.identifier(true))
  ))

  // a.$injectAs = 'name'
  if (injectable !== true) {
    path.insertAfter(t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(
          id,
          t.identifier('$injectAs')
        ),
        t.stringLiteral(injectable))
    ))
  }

  if (isClass) {
    path.insertAfter(t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(
          id,
          t.identifier('$injectNewInstance')
        ),
        t.identifier(true))
    ))
  }

  // a.$injectParams = 'name'
  const params = fnNode.params.map(node => t.stringLiteral(node.name))
  if (!params.length) {
    return
  }
  path.insertAfter(t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(
        id,
        t.identifier('$injectParams')
      ),
      t.arrayExpression(
        params
      ))
  ))
}

/**
 * Get injection name from path's comment block.
 *
 * @param path
 *
 * @return {*}
 */
function injectionCommentBlock (path) {
  if (!path.node.leadingComments || !path.node.leadingComments[0]) {
    return false
  }
  const commentBlock = path.node.leadingComments[0].value
  return getInjectable(commentBlock)
}

/**
 * Transform declaration to expression.
 *
 * @param t
 * @param decl
 * @return {*}
 */
function declarationToExpression (t, decl) {
  if (decl.type === 'FunctionDeclaration') {
    return t.functionExpression(decl.id, decl.params, decl.body, decl.generator || false, decl.async || false)
  }
  else if (decl.type === 'ClassDeclaration') {
    return t.classExpression(decl.id, decl.superClass, decl.body, decl.decorators || [])
  }
  return decl
}

/**
 * Plugin.
 */
module.exports = function ({types}) {
  const t = types
  return {
    visitor: {
      'ExportDefaultDeclaration' (path) {
        if (!injectionCommentBlock(path)) {
          return
        }

        const childNode = path.node.declaration
        const varName = childNode.id || path.scope.generateUidIdentifier('uid')

        const localInstanceDeclaration = t.variableDeclaration('const', [
          t.variableDeclarator(
            varName,
            declarationToExpression(t, childNode)
          )
        ])
        path.insertBefore(localInstanceDeclaration)
        localInstanceDeclaration.leadingComments = path.node.leadingComments

        path.insertBefore(t.exportDefaultDeclaration(
          varName
        ))
        path.remove()
      },
      'ExportNamedDeclaration' (path) {
        if (!injectionCommentBlock(path)) {
          return
        }

        const childNode = path.node.declaration//Object.keys(path.node.declaration)

        path.insertBefore(childNode)
        childNode.leadingComments = path.node.leadingComments
        const childName = childNode.id || childNode.declarations[0].id
        path.insertBefore(t.exportNamedDeclaration(
          null,
          [
            t.exportSpecifier(
              childName,
              childName
            )
          ]
        ))
        path.remove()
      },

      'VariableDeclaration' (path) {
        const injectable = injectionCommentBlock(path)
        if (!injectable) {
          return
        }
        const declarator = path.node.declarations[0]
        const id = declarator.id
        appendInjectionExpressions(t, path, declarator.init, id, injectable)
      },

      'FunctionDeclaration|ClassDeclaration' (path) {
        const injectable = injectionCommentBlock(path)
        if (!injectable) {
          return
        }
        const id = path.node.id
        appendInjectionExpressions(t, path, path.node, id, injectable)
      }
    }
  }
}
