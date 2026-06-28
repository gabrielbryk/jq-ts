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
  visit(node, [])
}

const visit = (node: FilterNode, scope: Set<string>[]): void => {
  switch (node.kind) {
    case 'Identity':
    case 'Literal':
    case 'Var':
      return
    case 'FieldAccess':
      visit(node.target, scope)
      return
    case 'IndexAccess':
      visit(node.target, scope)
      visit(node.index, scope)
      return
    case 'Array':
      node.items.forEach((n) => visit(n, scope))
      return
    case 'Object':
      node.entries.forEach((entry) => {
        if (entry.key.kind === 'KeyExpr') {
          visit(entry.key.expr, scope)
        }
        visit(entry.value, scope)
      })
      return
    case 'Pipe':
    case 'Comma':
    case 'Alt':
      visit(node.left, scope)
      visit(node.right, scope)
      return
    case 'Binary':
    case 'Bool':
      visit(node.left, scope)
      visit(node.right, scope)
      return
    case 'Unary':
      visit(node.expr, scope)
      return
    case 'If':
      node.branches.forEach((branch) => {
        visit(branch.cond, scope)
        visit(branch.then, scope)
      })
      visit(node.else, scope)
      return
    case 'As':
      visit(node.bind, scope)
      visit(node.body, scope)
      return
    case 'Call': {
      // Check local scope first
      for (let i = scope.length - 1; i >= 0; i--) {
        if (scope[i]!.has(node.name)) {
          // Calls to in-scope local functions (args or nested defs) are not arity-checked; only builtins are.
          for (const arg of node.args) {
            visit(arg, scope)
          }
          return
        }
      }

      const specs = builtins[node.name]
      if (!specs || specs.length === 0) {
        throw new ValidationError(`Unknown function: ${node.name}`, node.span)
      }
      const match = specs.find((s) => s.arity === node.args.length)
      if (!match) {
        const arities = specs.map((s) => s.arity).join(' or ')
        throw new ValidationError(
          `Function ${node.name} expects ${arities} arguments, but got ${node.args.length}`,
          node.span
        )
      }
      for (const arg of node.args) {
        visit(arg, scope)
      }
      return
    }
    case 'Assignment':
      visit(node.left, scope)
      visit(node.right, scope)
      return
    case 'Def': {
      // The body sees its args (as 0-arity functions) and its own name (for recursion);
      // the next filter sees only the function name. None of these are arity-checked.
      const bodyScope = new Set(node.args)
      bodyScope.add(node.name)

      visit(node.body, [...scope, bodyScope])

      const nextScope = new Set([node.name])
      visit(node.next, [...scope, nextScope])
      return
    }
    case 'Reduce':
      visit(node.source, scope)
      visit(node.init, scope)
      visit(node.update, scope)
      return
    case 'Foreach':
      visit(node.source, scope)
      visit(node.init, scope)
      visit(node.update, scope)
      if (node.extract) visit(node.extract, scope)
      return
    case 'Try':
      visit(node.body, scope)
      if (node.handler) visit(node.handler, scope)
      return
    case 'Recurse':
    case 'Iterate':
    case 'Break':
      return
    case 'Label':
      visit(node.body, scope)
      return
    case 'Slice':
      visit(node.target, scope)
      if (node.start) visit(node.start, scope)
      if (node.end) visit(node.end, scope)
      return
    default: {
      const exhaustive: never = node
      return exhaustive
    }
  }
}
