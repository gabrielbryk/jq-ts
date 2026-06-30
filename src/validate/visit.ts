import type { FilterNode } from '../ast'
import { bindingHandlers } from './binding'
import { callHandlers } from './call'
import { controlHandlers } from './control'
import { formatHandlers } from './format'
import { structuralHandlers } from './structural'
import type { Handler, HandlerMap, Scope } from './types'

/**
 * Dispatch table from node kind to its validation handler. Leaf nodes
 * (Identity, Literal, Var, Recurse, Iterate, Break) have no handler and are
 * intentionally treated as no-ops.
 */
const handlers: HandlerMap = {
  ...structuralHandlers,
  ...controlHandlers,
  ...bindingHandlers,
  ...callHandlers,
  ...formatHandlers,
}

/** Recursively validates a node and its children via the dispatch table. */
export const visit = (node: FilterNode, scope: Scope): void => {
  const handler = handlers[node.kind] as Handler<FilterNode['kind']> | undefined
  handler?.(node, scope, visit)
}
