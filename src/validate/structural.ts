import type { HandlerMap } from './types'

/** Handlers for structural access/construction nodes. */
export const structuralHandlers: HandlerMap = {
  FieldAccess: (node, scope, visit) => {
    visit(node.target, scope)
  },
  IndexAccess: (node, scope, visit) => {
    visit(node.target, scope)
    visit(node.index, scope)
  },
  Array: (node, scope, visit) => {
    node.items.forEach((n) => visit(n, scope))
  },
  Object: (node, scope, visit) => {
    node.entries.forEach((entry) => {
      if (entry.key.kind === 'KeyExpr') {
        visit(entry.key.expr, scope)
      }
      visit(entry.value, scope)
    })
  },
  Slice: (node, scope, visit) => {
    visit(node.target, scope)
    if (node.start) visit(node.start, scope)
    if (node.end) visit(node.end, scope)
  },
  Assignment: (node, scope, visit) => {
    visit(node.left, scope)
    visit(node.right, scope)
  },
}
