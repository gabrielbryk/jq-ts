import type { FilterNode } from './ast'
import { ValidationError } from './errors'
import { builtins } from './builtins'

/**
 * Validates the AST for correctness and supported features.
 * Checks for unknown function calls and arity mismatches.
 *
 * @param node - The root AST node to validate.
 * @throws {ValidationError} If validation fails.
 */
export const validate = (node: FilterNode): void => {
  visit(node)
}

const visit = (node: FilterNode): void => {
  switch (node.kind) {
    case 'Identity':
    case 'Literal':
    case 'Var':
      return
    case 'FieldAccess':
      visit(node.target)
      return
    case 'IndexAccess':
      visit(node.target)
      visit(node.index)
      return
    case 'Array':
      node.items.forEach(visit)
      return
    case 'Object':
      node.entries.forEach((entry) => {
        if (entry.key.kind === 'KeyExpr') {
          visit(entry.key.expr)
        }
        visit(entry.value)
      })
      return
    case 'Pipe':
    case 'Comma':
    case 'Alt':
      visit(node.left)
      visit(node.right)
      return
    case 'Binary':
    case 'Bool':
      visit(node.left)
      visit(node.right)
      return
    case 'Unary':
      visit(node.expr)
      return
    case 'If':
      node.branches.forEach((branch) => {
        visit(branch.cond)
        visit(branch.then)
      })
      visit(node.else)
      return
    case 'As':
      visit(node.bind)
      visit(node.body)
      return
    case 'Call': {
      const builtin = builtins[node.name]
      if (!builtin) {
        throw new ValidationError(`Unknown function: ${node.name}`, node.span)
      }
      if (builtin.arity !== node.args.length) {
        throw new ValidationError(
          `Function ${node.name} expects ${builtin.arity} arguments, but got ${node.args.length}`,
          node.span
        )
      }
      node.args.forEach(visit)
      return
    }
    case 'Reduce':
      visit(node.source)
      visit(node.init)
      visit(node.update)
      return
    case 'Foreach':
      visit(node.source)
      visit(node.init)
      visit(node.update)
      if (node.extract) visit(node.extract)
      return
    case 'Try':
      visit(node.body)
      if (node.handler) visit(node.handler)
      return
    case 'Recurse':
    case 'Iterate':
      return
    default: {
      // Exhaustive check
      const exhaustive: never = node
      return exhaustive
    }
  }
}
