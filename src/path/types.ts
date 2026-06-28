import { RuntimeError } from '../errors'
import type { Span } from '../span'
import { isPlainObject, type Value, type ValueObject } from '../value'

/** A single step in a jq path: an object key, an array index, or an array slice. */
export type PathSegment = string | number | { start: number | null; end: number | null }

export const objValue = (obj: ValueObject, key: string): Value => obj[key]!

const isPath = (val: Value): val is PathSegment[] => {
  if (!Array.isArray(val)) return false
  return val.every(
    (p) =>
      typeof p === 'string' ||
      (typeof p === 'number' && Number.isInteger(p)) ||
      (isPlainObject(p) && ('start' in p || 'end' in p))
  )
}

/** Validates that a value is a well-formed jq path, or throws. */
export const ensurePath = (val: Value, span: Span): PathSegment[] => {
  if (isPath(val)) return val
  throw new RuntimeError('Path must be an array of strings, integers, or slice objects', span)
}
