import type { Span } from '../span'
import type { LimitTracker } from '../limits'
import { type Value, type ValueObject } from '../value'

export const emit = (value: Value, span: Span, tracker: LimitTracker): Value => {
  tracker.emit(span)
  return value
}

export const ensureIndex = (val: Value): number | undefined => {
  if (typeof val === 'number' && Number.isInteger(val)) return val
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
  const entries = keys.map(
    (k) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      `${JSON.stringify(k)}:${stableStringify((value as ValueObject)[k]!)}`
  )
  return `{${entries.join(',')}}`
}
