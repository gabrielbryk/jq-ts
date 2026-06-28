import type { FilterNode } from '../ast'

/** Scope stack of locally-bound function/argument names. */
export type Scope = Set<string>[]

/** Recursively validates a node and its children. */
export type Visit = (node: FilterNode, scope: Scope) => void

/** Handler for a single AST node kind. */
export type Handler<K extends FilterNode['kind']> = (
  node: Extract<FilterNode, { kind: K }>,
  scope: Scope,
  visit: Visit
) => void

/** Partial map from node kind to its validation handler. */
export type HandlerMap = {
  [K in FilterNode['kind']]?: Handler<K>
}
