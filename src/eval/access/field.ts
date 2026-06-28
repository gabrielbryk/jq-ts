import type { FilterNode } from '../../ast'
import { RuntimeError } from '../../errors'
import type { LimitTracker } from '../../limits'
import type { Evaluator } from '../../types'
import { describeType, isPlainObject, type Value } from '../../value'
import { emit } from '../common'
import type { EnvStack } from '../types'

/**
 * Evaluates field access (`.foo`).
 *
 * @param node - The field access AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalField = function* (
  node: Extract<FilterNode, { kind: 'FieldAccess' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  for (const container of evaluate(node.target, input, env, tracker)) {
    if (container === null) {
      yield emit(null, node.span, tracker)
      continue
    }
    if (isPlainObject(container)) {
      yield emit(
        Object.prototype.hasOwnProperty.call(container, node.field) ? container[node.field]! : null,
        node.span,
        tracker
      )
      continue
    }
    throw new RuntimeError(`Cannot index ${describeType(container)} with string`, node.span)
  }
}
