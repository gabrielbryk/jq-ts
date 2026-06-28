import type { FilterNode } from '../../ast'
import { RuntimeError } from '../../errors'
import type { LimitTracker } from '../../limits'
import type { Evaluator } from '../../types'
import type { Value } from '../../value'
import { applyBinaryOp } from '../ops'
import type { EnvStack } from '../types'

const SUGAR_BINARY_OPS: Record<string, string> = {
  '+=': '+',
  '-=': '-',
  '*=': '*',
  '/=': '/',
  '%=': '%',
}

/**
 * Computes the result of a single sugar update op (`+=`, `-=`, `//=`, etc.)
 * for one right-hand-side value.
 */
function computeSugarOpValue(op: string, oldValue: Value, rhs: Value, rhsNode: FilterNode): Value {
  if (op === '//=') {
    // false is falsey in jq, so //= should replace if left is false or null.
    return oldValue !== null && oldValue !== false ? oldValue : rhs
  }

  const binaryOp = SUGAR_BINARY_OPS[op]
  if (binaryOp === undefined) {
    throw new RuntimeError(`Unknown assignment op: ${op}`, rhsNode.span)
  }
  return applyBinaryOp(binaryOp, oldValue, rhs, rhsNode.span)
}

/**
 * Determines the new value(s) for a single path given an update op.
 *
 * For `|=` the RHS is evaluated against the old value at the path.
 * For sugar ops the RHS is evaluated against the original context input and
 * combined with the old value via {@link computeSugarOpValue}.
 */
export function computeNewValues(
  op: string,
  oldValue: Value,
  rhsNode: FilterNode,
  contextInput: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Value[] {
  if (op === '|=') {
    return Array.from(evaluate(rhsNode, oldValue, env, tracker))
  }

  const rhsResults = Array.from(evaluate(rhsNode, contextInput, env, tracker))
  return rhsResults.map((rhs) => computeSugarOpValue(op, oldValue, rhs, rhsNode))
}
