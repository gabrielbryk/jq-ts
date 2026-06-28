import { RuntimeError } from '../errors'
import type { Span } from '../span'
import { describeType, type Value } from '../value'
import { add, div, mod, mul, sub } from './ops/arithmetic'
import { applyComparison } from './ops/compare'

export { add } from './ops/arithmetic'

/**
 * Applies a unary negation (`-`).
 *
 * @param value - The value to negate.
 * @param span - Source span for errors.
 * @returns The negated value.
 */
export const applyUnaryNeg = (value: Value, span: Span): Value => {
  if (typeof value === 'number') {
    return -value
  }
  throw new RuntimeError(`Invalid operand for unary -: ${describeType(value)}`, span)
}

/**
 * Applies a binary operator.
 *
 * Supports arithmetic (`+`, `-`, `*`, `/`, `%`) and comparators.
 *
 * @param op - The operator string.
 * @param left - The left operand.
 * @param right - The right operand.
 * @param span - Source span for errors.
 * @returns The result of the operation.
 */
export const applyBinaryOp = (op: string, left: Value, right: Value, span: Span): Value => {
  switch (op) {
    case '+':
      return add(left, right, span)
    case '-':
      return sub(left, right, span)
    case '*':
      return mul(left, right, span)
    case '/':
      return div(left, right, span)
    case '%':
      return mod(left, right, span)
    default:
      return applyComparison(op, left, right, span)
  }
}
