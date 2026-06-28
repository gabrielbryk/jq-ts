import type { IdentityNode, LiteralNode } from '../ast'
import type { LimitTracker } from '../limits'
import type { Value } from '../value'
import { emit } from './common'

/**
 * Identity filter `.`: yields the input unchanged.
 */
export function* evalIdentity(
  node: IdentityNode,
  input: Value,
  tracker: LimitTracker
): Generator<Value, void, undefined> {
  yield emit(input, node.span, tracker)
}

/**
 * Literal value: yields the constant.
 */
export function* evalLiteral(
  node: LiteralNode,
  tracker: LimitTracker
): Generator<Value, void, undefined> {
  yield emit(node.value, node.span, tracker)
}
