import { RuntimeError } from '../errors'
import { describeType, type Value } from '../value'
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
      return isEqual(left, right)
    case 'Neq':
      return !isEqual(left, right)
    case 'Lt':
      return compare(left, right) < 0
    case 'Lte':
      return compare(left, right) <= 0
    case 'Gt':
      return compare(left, right) > 0
    case 'Gte':
      return compare(left, right) >= 0
    default:
      throw new RuntimeError(`Unknown binary operator: ${op}`, span)
  }
}

// Comparison helpers
function isEqual(a: Value, b: Value): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => isEqual(v, b[i] as Value))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a).sort()
    const kb = Object.keys(b).sort()
    if (ka.length !== kb.length) return false
    if (!ka.every((k, i) => k === kb[i])) return false
    return ka.every((k) => isEqual(a[k]!, b[k]!))
  }
  return false
}

function compare(a: Value, b: Value): number {
  if (a === b) return 0
  const typeOrder = (v: Value) => {
    if (v === null) return 0
    if (typeof v === 'boolean') return 1
    if (typeof v === 'number') return 2
    if (typeof v === 'string') return 3
    if (Array.isArray(v)) return 4
    if (isPlainObject(v)) return 5
    return 6
  }

  const ta = typeOrder(a)
  const tb = typeOrder(b)
  if (ta !== tb) return ta - tb

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return (a ? 1 : 0) - (b ? 1 : 0)
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a < b ? -1 : 1
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const c = compare(a[i]!, b[i]!)
      if (c !== 0) return c
    }
    return a.length - b.length
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    // Compare by keys then values
    const keysA = Object.keys(a).sort()
    const keysB = Object.keys(b).sort()

    for (let i = 0; i < Math.min(keysA.length, keysB.length); i++) {
      const kA = keysA[i]!
      const kB = keysB[i]!
      if (kA !== kB) return kA < kB ? -1 : 1
      const c = compare(a[kA]!, b[kB]!)
      if (c !== 0) return c
    }
    return keysA.length - keysB.length
  }
  return 0
}

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
    // float modulo? JS % operator
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
      result[key] = mergeDeep(tVal as Record<string, Value>, sVal as Record<string, Value>)
    } else {
      result[key] = sVal
    }
  }
  return result
}

function isPlainObject(v: Value): v is Record<string, Value> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
