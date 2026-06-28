import type { Span } from '../span'
import type { LimitTracker } from '../limits'
import { type Value, type ValueObject } from '../value'

export const emit = (value: Value, span: Span, tracker: LimitTracker): Value => {
  tracker.emit(span)
  return value
}

/**
 * Typed accessor for an object value by key.
 *
 * Centralizes the `obj[key]` lookup so call sites stay narrowed to
 * {@link ValueObject} without repeated assertions.
 */
export const objValue = (obj: ValueObject, key: string): Value => obj[key]!

export const ensureIndex = (val: Value): number | undefined => {
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return undefined
    return Math.trunc(val)
  }
  if (typeof val === 'string' && /^-?\d+$/.test(val)) return parseInt(val, 10)
  return undefined
}

export const stableStringify = (value: Value): string => {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  // Object: sort keys
  const keys = Object.keys(value).sort()
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(objValue(value, k))}`)
  return `{${entries.join(',')}}`
}
