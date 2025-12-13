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
          // Local function (argument or nested def).
          // We assume arity check matches or is loose for arguments (arity 0 effectively)
          // If it is an ARGUMENT, it is arity 0.
          // If it is a nested DEF, it has specific arity.
          // However, validating arity for local functions is harder without tracking definitions in scope.
          // For now, if name is in scope, we assume it's valid.
          // Refine this if needed.
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
      // Add name to scope for recursion (if recursive)
      // And arguments to scope for body.
      // Wait, Def name visible in 'next'? Yes.
      // Def name visible in 'body'? Yes (recursion).

      // Def args visible in BODY only.

      // 1. Validate body with args usage
      // Arguments are 0-arity functions
      const bodyScope = new Set(node.args)
      bodyScope.add(node.name) // Recursive

      visit(node.body, [...scope, bodyScope])

      // 2. Validate next with function name in scope
      // We need to track the function definition itself.
      // For simplicity, just add name to scope.
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
