import { RuntimeError } from '../errors'
import type { Span } from '../span'
import { isPlainObject, type Value } from '../value'
import { objValue, type PathSegment } from './types'

const DUMMY_SPAN: Span = { start: 0, end: 0 }

/** Reads the value at a path, or `undefined` if any segment is missing. */
export const getPath = (
  root: Value,
  path: PathSegment[],
  span: Span = DUMMY_SPAN
): Value | undefined => {
  let curr = root
  for (const part of path) {
    if (curr === null) return undefined
    if (typeof part === 'string' && isPlainObject(curr)) {
      if (!Object.prototype.hasOwnProperty.call(curr, part)) return undefined
      curr = objValue(curr, part)
    } else if (typeof part === 'number' && Array.isArray(curr)) {
      const idx = part < 0 ? curr.length + part : part
      if (idx < 0 || idx >= curr.length) return undefined
      curr = curr[idx]!
    } else if (typeof part === 'string' || typeof part === 'number') {
      // Tried to traverse through a non-container type (e.g., number, boolean, string)
      throw new RuntimeError(
        `null (null) and ${typeof part} (${String(part)}) cannot be iterated over`,
        span
      )
    } else {
      return undefined
    }
  }
  return curr
}
