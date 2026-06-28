import type { CallNode } from '../ast'
import { builtins } from '../builtins'
import { ValidationError } from '../errors'
import type { HandlerMap, Scope, Visit } from './types'

/** Returns true if the call name resolves to a local (in-scope) function. */
const isLocalCall = (name: string, scope: Scope): boolean => {
  for (let i = scope.length - 1; i >= 0; i--) {
    if (scope[i]!.has(name)) return true
  }
  return false
}

/** Validates that a builtin call exists and is invoked with a supported arity. */
const checkBuiltinArity = (node: CallNode): void => {
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
}

const validateCall = (node: CallNode, scope: Scope, visit: Visit): void => {
  // Calls to in-scope local functions (args or nested defs) are not arity-checked;
  // only builtins are.
  if (!isLocalCall(node.name, scope)) {
    checkBuiltinArity(node)
  }
  for (const arg of node.args) {
    visit(arg, scope)
  }
}

/** Handler for function-call nodes. */
export const callHandlers: HandlerMap = {
  Call: validateCall,
}
