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

  let commentsHolder = path.node
  if (fnNode.body && fnNode.body.type === 'ClassBody') {
    fnNode = fnNode.body.body.find(node => node.kind === 'constructor')
    if (!fnNode) {
      fnNode = {params: []}
    }
    else {
      commentsHolder = fnNode
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
  const aliases = getParamsAliases(commentsHolder, params)
  const a = path.insertAfter(t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(
        id,
        t.identifier('$injectParams')
      ),
      t.stringLiteral('a'))
  ))
  a[0].replaceWithSourceString(`${id.name}.$injectParams = ` + JSON.stringify(aliases))
}

/**
 * Get leading comments from the given path.
 *
 * @param path
 *
 * @return {string|boolean}
 */
function getLeadingComments (path) {
  const lookup = path.node || path
  if (!lookup.leadingComments || !lookup.leadingComments[0]) {
    return false
  }
  return lookup.leadingComments[0].value
}

/**
 * Look for dependencies aliases.
 *
 * @param node
 * @param params
 *
 * @return {object|boolean}
 */
function getParamsAliases (node, params) {
  const comments = getLeadingComments(node)
  let aliases = makeDependenciesAliases(comments)
  for (let param of params) {
    if (!aliases[param.value]) {
      aliases[param.value] = {
        from: param.value
      }
    }
  }
  return aliases
}

/**
 * Make aliases from comments string.
 *
 * @param comments
 *
 * @return {object}
 */
function makeDependenciesAliases (comments) {
  const regex = /@dependency {(.*)?} (.*)/gm
  let m
  let matches = {}

  while ((m = regex.exec(comments)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex++
    }
    let dep = []
    m.forEach((match, groupIndex) => {
      dep.push(match)
    })
    let [path, defaultString] = dep[1].split(' = ')
    matches[dep[2]] = {
      from: path
    }
    if (defaultString) {
      matches[dep[2]]['default'] = JSON.parse(defaultString)
    }
  }

  return matches
}

/**
 * Get injection name from path's comment block.
 *
 * @param path
 *
 * @return {*}
 */
function injectionCommentBlock (path) {
  const commentBlock = getLeadingComments(path)
  if (!commentBlock) {
    return false
  }
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
