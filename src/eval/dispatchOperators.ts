import type { BinaryNode, BoolNode, UnaryNode } from '../ast'
import type { LimitTracker } from '../limits'
import type { Evaluator } from '../types'
import { isTruthy, type Value } from '../value'
import { emit } from './common'
import { applyBinaryOp, applyUnaryNeg } from './ops'
import type { EnvStack } from './types'

/**
 * Unary operators `-` (negation) and `not`.
 */
export function* evalUnary(
  node: UnaryNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value, void, undefined> {
  if (node.op === 'Not') {
    for (const value of evaluate(node.expr, input, env, tracker)) {
      yield emit(!isTruthy(value), node.span, tracker)
    }
  } else {
    for (const value of evaluate(node.expr, input, env, tracker)) {
      yield emit(applyUnaryNeg(value, node.span), node.span, tracker)
    }
  }
}

/**
 * Short-circuiting boolean operators `and` / `or`.
 */
export function* evalBool(
  node: BoolNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value, void, undefined> {
  for (const l of evaluate(node.left, input, env, tracker)) {
    if (node.op === 'And') {
      if (!isTruthy(l)) {
        yield emit(false, node.span, tracker)
      } else {
        // l is truthy here, so the result is the truthiness of r.
        for (const r of evaluate(node.right, input, env, tracker)) {
          yield emit(isTruthy(r), node.span, tracker)
        }
      }
    } else {
      // Or
      if (isTruthy(l)) {
        yield emit(true, node.span, tracker)
      } else {
        // l is falsy here, so the result is the truthiness of r.
        for (const r of evaluate(node.right, input, env, tracker)) {
          yield emit(isTruthy(r), node.span, tracker)
        }
      }
    }
  }
}

/**
 * Binary arithmetic and comparison operators (cartesian product of operands).
 */
export function* evalBinary(
  node: BinaryNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value, void, undefined> {
  const leftRes = Array.from(evaluate(node.left, input, env, tracker))
  const rightRes = Array.from(evaluate(node.right, input, env, tracker))
  for (const l of leftRes) {
    for (const r of rightRes) {
      yield emit(applyBinaryOp(node.op, l, r, node.span), node.span, tracker)
    }
  }
}
