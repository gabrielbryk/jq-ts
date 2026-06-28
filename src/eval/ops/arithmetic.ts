import { stableStringify } from '../../builtins/utils'
import { RuntimeError } from '../../errors'
import type { Span } from '../../span'
import { describeType, isPlainObject, type Value } from '../../value'

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

export function sub(left: Value, right: Value, span: Span): Value {
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (Array.isArray(left) && Array.isArray(right)) {
    // Remove all occurrences of items in right from left
    const toRemove = new Set(right.map(stableStringify)) // Use stable stringify for value equality check
    return left.filter((x) => !toRemove.has(stableStringify(x)))
  }
  throw new RuntimeError(`Cannot subtract ${describeType(right)} from ${describeType(left)}`, span)
}

export function mul(left: Value, right: Value, span: Span): Value {
  if (typeof left === 'number' && typeof right === 'number') return left * right

  // String repetition
  if (typeof left === 'string' && typeof right === 'number') return repeatString(left, right)
  if (typeof left === 'number' && typeof right === 'string') return repeatString(right, left)

  if (isPlainObject(left) && isPlainObject(right)) {
    return mergeDeep(left, right)
  }

  throw new RuntimeError(`Cannot multiply ${describeType(left)} by ${describeType(right)}`, span)
}

export function div(left: Value, right: Value, span: Span): Value {
  if (typeof left === 'number' && typeof right === 'number') {
    if (right === 0) throw new RuntimeError('Division by zero', span)
    return left / right
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return left.split(right)
  }
  throw new RuntimeError(`Cannot divide ${describeType(left)} by ${describeType(right)}`, span)
}

export function mod(left: Value, right: Value, span: Span): Value {
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
