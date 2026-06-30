import type { FormatNode } from '../ast'
import { applyFormat } from '../format'
import type { LimitTracker } from '../limits'
import type { Value } from '../value'
import { emit } from './common'
import type { EnvStack, Evaluator } from './types'

/**
 * Evaluates an `@`-format node.
 *
 * With `str` (a `@name "..."` string form) the node is just its desugared
 * interpolation — literal text plus per-value encoder pipes — so we evaluate
 * `str` directly. Bare (`@name`) it encodes the input value.
 */
export function* evalFormat(
  node: FormatNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value, void, undefined> {
  if (node.str) {
    yield* evaluate(node.str, input, env, tracker)
    return
  }
  yield emit(applyFormat(node.name, input, node.span), node.span, tracker)
}
