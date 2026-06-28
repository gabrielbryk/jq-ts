import type { HandlerMap } from './types'

/** Handlers for control-flow and operator nodes. */
export const controlHandlers: HandlerMap = {
  Pipe: (node, scope, visit) => {
    visit(node.left, scope)
    visit(node.right, scope)
  },
  Comma: (node, scope, visit) => {
    visit(node.left, scope)
    visit(node.right, scope)
  },
  Alt: (node, scope, visit) => {
    visit(node.left, scope)
    visit(node.right, scope)
  },
  Binary: (node, scope, visit) => {
    visit(node.left, scope)
    visit(node.right, scope)
  },
  Bool: (node, scope, visit) => {
    visit(node.left, scope)
    visit(node.right, scope)
  },
  Unary: (node, scope, visit) => {
    visit(node.expr, scope)
  },
  If: (node, scope, visit) => {
    node.branches.forEach((branch) => {
      visit(branch.cond, scope)
      visit(branch.then, scope)
    })
    visit(node.else, scope)
  },
  Try: (node, scope, visit) => {
    visit(node.body, scope)
    if (node.handler) visit(node.handler, scope)
  },
  Label: (node, scope, visit) => {
    visit(node.body, scope)
  },
}
