import type { FilterNode } from '../ast'
import type { LimitTracker } from '../limits'
import { type PathSegment, updatePath } from '../path'
import type { Evaluator } from '../types'
import { compareValues, type Value } from '../value'
import { applyUpdates } from './assignment/applyUpdates'
import { emit } from './common'
import { evaluatePath } from './pathEval'
import type { EnvStack } from './types'

/**
 * Evaluates a plain assignment (`=`): for each RHS value, set every resolved
 * path to that value and emit the resulting document.
 */
function* evalPlainAssignment(
  node: Extract<FilterNode, { kind: 'Assignment' }>,
  input: Value,
  paths: PathSegment[][],
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  const rhsValues = Array.from(evaluate(node.right, input, env, tracker))
  if (rhsValues.length === 0) return

  for (const rhsVal of rhsValues) {
    let current = input
    for (const path of paths) {
      current = updatePath(current, path, () => rhsVal, node.span) ?? current
    }
    yield emit(current, node.span, tracker)
  }
}

/**
 * Evaluates assignment and update operators (`=`, `|=`, `+=`, etc.).
 *
 * Implements the complex path update logic of jq.
 * It first resolves the path(s) on the left-hand side, then computes new values,
 * and finally reconstructs the object with the updated values.
 *
 * @param node - The assignment AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalAssignment = function* (
  node: Extract<FilterNode, { kind: 'Assignment' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  const paths = Array.from(evaluatePath(node.left, input, env, tracker, evaluate))
  // Sort paths descending to handle array deletion correctly (higher indices first)
  paths.sort((a, b) => compareValues(a, b) * -1)

  if (paths.length === 0) {
    yield emit(input, node.span, tracker)
    return
  }

  // Case 1: Plain Assignment '='
  if (node.op === '=') {
    yield* evalPlainAssignment(node, input, paths, env, tracker, evaluate)
    return
  }

  // Case 2: Update Assignment '|=', '+=', etc.
  yield* applyUpdates(input, paths, 0, node.op, node.right, input, env, tracker, evaluate)
}
