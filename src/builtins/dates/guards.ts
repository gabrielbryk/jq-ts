import { RuntimeError } from '../../errors'
import type { Span } from '../../span'
import { describeType, type Value } from '../../value'

/** Input/argument type guards shared by the date builtins. */

export const requireNumber = (input: Value, fn: string, span: Span): number => {
  if (typeof input !== 'number') {
    throw new RuntimeError(`${fn}() requires numeric inputs`, span)
  }
  return input
}

export const requireString = (input: Value, fn: string, span: Span): string => {
  if (typeof input !== 'string') {
    throw new RuntimeError(`${fn} requires a string, got ${describeType(input)}`, span)
  }
  return input
}

export const readFormat = (value: Value, fn: string, span: Span): string => {
  if (typeof value !== 'string') {
    throw new RuntimeError(`${fn}/1 requires a string format`, span)
  }
  return value
}
