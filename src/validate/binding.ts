import type { HandlerMap } from './types'

/** Handlers for binding/iteration nodes that introduce or thread scope. */
export const bindingHandlers: HandlerMap = {
  As: (node, scope, visit) => {
    visit(node.bind, scope)
    visit(node.body, scope)
  },
  Def: (node, scope, visit) => {
    // The body sees its args (as 0-arity functions) and its own name (for recursion);
    // the next filter sees only the function name. None of these are arity-checked.
    const bodyScope = new Set(node.args)
    bodyScope.add(node.name)

    visit(node.body, [...scope, bodyScope])

    const nextScope = new Set([node.name])
    visit(node.next, [...scope, nextScope])
  },
  Reduce: (node, scope, visit) => {
    visit(node.source, scope)
    visit(node.init, scope)
    visit(node.update, scope)
  },
  Foreach: (node, scope, visit) => {
    visit(node.source, scope)
    visit(node.init, scope)
    visit(node.update, scope)
    if (node.extract) visit(node.extract, scope)
  },
}
