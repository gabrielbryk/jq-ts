import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import type { Span } from '../span'
import type { Value } from '../value'

/**
 * Emits a value, recording it in the limits tracker.
 *
 * @param value - The value to yield.
 * @param span - The source span responsible for this value.
 * @param tracker - The limits tracker.
 * @returns The value itself.
 */
export const emit = (value: Value, span: Span, tracker: LimitTracker): Value => {
  tracker.emit(span)
  return value
}

/**
 * Converts a value to an array index.
 * Truncates floats to integers. Returns null if input is null.
 * Throws a RuntimeError for non-numeric types.
 *
 * @param value - The value to convert.
 * @param span - To report error.
 * @returns The integer index or null.
 */
export const toIndex = (value: Value, span: Span): number | null => {
  if (value === null) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return Math.trunc(value)
  }
  throw new RuntimeError('Expected numeric index', span)
}
