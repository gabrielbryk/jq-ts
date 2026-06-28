import { RuntimeError } from '../errors'
import { compareValues, describeType, isPlainObject, valueEquals, type Value } from '../value'
import { stableStringify } from '../builtins/utils'
import type { Span } from '../span'

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

/**
 * Adds two values per jq's `+` semantics.
 *
 * Numbers add arithmetically, strings and arrays concatenate, objects merge
 * (shallow), and `null` acts as the identity for either operand.
 *
 * @param left - The left operand.
 * @param right - The right operand.
 * @param span - Source span for errors.
 * @returns The combined value.
 */
export function add(left: Value, right: Value, span: Span): Value {
  if (left === null) return right
  if (right === null) return left
  if (typeof left === 'number' && typeof right === 'number') return left + right
  if (typeof left === 'string' && typeof right === 'string') return left + right
  if (Array.isArray(left) && Array.isArray(right)) return [...left, ...right]
  if (isPlainObject(left) && isPlainObject(right)) return { ...left, ...right } // Merge (shallow)
  throw new RuntimeError(`Cannot add ${describeType(left)} and ${describeType(right)}`, span)
}

function sub(left: Value, right: Value, span: Span): Value {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (Array.isArray(left) && Array.isArray(right)) {
    // Remove all occurrences of items in right from left
    const toRemove = new Set(right.map(stableStringify)) // Use stable stringify for value equality check
    return left.filter((x) => !toRemove.has(stableStringify(x)))
  }
  throw new RuntimeError(`Cannot subtract ${describeType(right)} from ${describeType(left)}`, span)
}

function mul(left: Value, right: Value, span: Span): Value {
  if (typeof left === 'number' && typeof right === 'number') return left * right

  // String repetition
  if (typeof left === 'string' && typeof right === 'number') return repeatString(left, right)
  if (typeof left === 'number' && typeof right === 'string') return repeatString(right, left)

  if (isPlainObject(left) && isPlainObject(right)) {
    return mergeDeep(left, right)
  }

  throw new RuntimeError(`Cannot multiply ${describeType(left)} by ${describeType(right)}`, span)
}

function div(left: Value, right: Value, span: Span): Value {
  if (typeof left === 'number' && typeof right === 'number') {
    if (right === 0) throw new RuntimeError('Division by zero', span)
    return left / right
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return left.split(right)
  }
  throw new RuntimeError(`Cannot divide ${describeType(left)} by ${describeType(right)}`, span)
}

function mod(left: Value, right: Value, span: Span): Value {
  if (typeof left === 'number' && typeof right === 'number') {
    if (right === 0) throw new RuntimeError('Modulo by zero', span)
    return left % right
  }
  throw new RuntimeError(`Cannot modulo ${describeType(left)} by ${describeType(right)}`, span)
}

function repeatString(str: string, count: number): string | null {
  if (count <= 0) return null
  const n = Math.floor(count)
  if (n <= 0) return null
  return str.repeat(n)
}

function mergeDeep(
  target: Record<string, Value>,
  source: Record<string, Value>
): Record<string, Value> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const sVal = source[key]!
    const tVal = result[key]
    if (isPlainObject(sVal) && tVal !== undefined && isPlainObject(tVal)) {
      result[key] = mergeDeep(tVal, sVal)
    } else {
      result[key] = sVal
    }
  }
  return result
}
