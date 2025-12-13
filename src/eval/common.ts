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
 * Ensures a value is an integer. Throws a RuntimeError otherwise.
 *
 * @param value - The value to check.
 * @param span - To report error.
 * @returns The integer value.
 */
export const ensureInteger = (value: Value, span: Span): number => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }
  throw new RuntimeError('Expected integer', span)
}
