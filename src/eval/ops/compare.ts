import { RuntimeError } from '../../errors'
import type { Span } from '../../span'
import { compareValues, type Value, valueEquals } from '../../value'

/**
 * Applies a comparison operator (`Eq`, `Neq`, `Lt`, `Lte`, `Gt`, `Gte`).
 *
 * @param op - The comparison operator string.
 * @param left - The left operand.
 * @param right - The right operand.
 * @param span - Source span for errors.
 * @returns The boolean result of the comparison.
 */
export function applyComparison(op: string, left: Value, right: Value, span: Span): boolean {
  switch (op) {
    case 'Eq':
      return valueEquals(left, right)
    case 'Neq':
      return !valueEquals(left, right)
    case 'Lt':
      return compareValues(left, right) < 0
    case 'Lte':
      return compareValues(left, right) <= 0
    case 'Gt':
      return compareValues(left, right) > 0
    case 'Gte':
      return compareValues(left, right) >= 0
    default:
      throw new RuntimeError(`Unknown binary operator: ${op}`, span)
  }
}
