/**
 * Represents any valid JSON value supported by the jq-ts runtime.
 * This is a recursive type definition that matches the structure of JSON data.
 */
// Use interface to break circular reference for Value type
export type Value = null | boolean | number | string | ValueArray | ValueObject

/**
 * Represents a JSON array containing {@link Value} items.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ValueArray extends Array<Value> {}

/**
 * Represents a JSON object with string keys and {@link Value} values.
 */
export interface ValueObject {
  [key: string]: Value
}

/**
 * Checks if a value is considered "truthy" in jq logic.
 * In jq, only `false` and `null` are falsey; everything else (including 0 and empty strings) is truthy.
 *
 * @param value - The value to check.
 * @returns `true` if truthy, `false` otherwise.
 */
export const isTruthy = (value: Value): boolean => !(value === false || value === null)

/**
 * deeply compares two JSON values for equality.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns `true` if the values are structurally equal, `false` otherwise.
 */
export const valueEquals = (a: Value, b: Value): boolean => {
  if (a === b) {
    // Handles primitives not involving NaN.
    return true
  }
  if (typeof a !== typeof b) {
    return false
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return Object.is(a, b)
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
      if (!valueEquals(a[i]!, b[i]!)) return false
    }
    return true
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).sort()
    const bKeys = Object.keys(b).sort()
    if (aKeys.length !== bKeys.length) return false
    for (let i = 0; i < aKeys.length; i += 1) {
      const key = aKeys[i]!
      if (key !== bKeys[i]) return false
      // Type safe access via key existence check implicit in loop
      if (!valueEquals(a[key]!, b[key]!)) return false
    }
    return true
  }
  return false
}

/**
 * Compares two JSON values according to standard jq ordering rules.
 *
 * The sort order is: null < false < true < numbers < strings < arrays < objects.
 * Arrays and objects are compared recursively.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns `-1` if `a < b`, `0` if `a == b`, and `1` if `a > b`.
 */
export const compareValues = (a: Value, b: Value): -1 | 0 | 1 => {
  if (valueEquals(a, b)) return 0
  const rankDiff = typeRank(a) - typeRank(b)
  if (rankDiff !== 0) return rankDiff < 0 ? -1 : 1

  if (typeof a === 'number' && typeof b === 'number') {
    return a < b ? -1 : 1
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a < b ? -1 : 1
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i += 1) {
      const cmp = compareValues(a[i]!, b[i]!)
      if (cmp !== 0) return cmp
    }
    return a.length < b.length ? -1 : 1
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).sort()
    const bKeys = Object.keys(b).sort()
    const len = Math.min(aKeys.length, bKeys.length)
    for (let i = 0; i < len; i += 1) {
      const key = aKeys[i]!
      const keyCmp = compareStrings(key, bKeys[i]!)
      if (keyCmp !== 0) return keyCmp
      const valueCmp = compareValues(a[key]!, b[key]!)
      if (valueCmp !== 0) return valueCmp
    }
    return aKeys.length < bKeys.length ? -1 : 1
  }

  // Remaining ranks are booleans and null which have already been handled by rank diff.
  return 0
}

const compareStrings = (a: string, b: string): -1 | 0 | 1 => {
  if (a === b) return 0
  return a < b ? -1 : 1
}

const typeRank = (value: Value): number => {
  if (value === null) return 0
  if (value === false) return 1
  if (value === true) return 2
  if (typeof value === 'number') return 3
  if (typeof value === 'string') return 4
  if (Array.isArray(value)) return 5
  return 6 // object
}

/**
 * Checks if a value is a plain JSON object (and not null or an array).
 *
 * @param value - The value to check.
 * @returns `true` if `value` is a non-null object (and not an array).
 */
export const isPlainObject = (value: Value): value is ValueObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Checks if a value is a JSON array.
 *
 * @param value - The value to check.
 * @returns `true` if `value` is an array.
 */
export const isValueArray = (value: Value): value is ValueArray => Array.isArray(value)

/**
 * Returns the type name of a value as a string (e.g., "null", "boolean", "number", "string", "array", "object").
 * This corresponds to the output of the `type` builtin.
 *
 * @param value - The value to inspect.
 * @returns The lower-case type name.
 */
export const describeType = (value: Value): string => {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value)) return 'array'
  return 'object'
}
