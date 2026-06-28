import { isPlainObject, type Value } from '../value'
import { objValue, type PathSegment } from './types'

/** Reads the value at a path, or `undefined` if any segment is missing. */
export const getPath = (root: Value, path: PathSegment[]): Value | undefined => {
  let curr = root
  for (const part of path) {
    if (curr === null) return undefined
    if (typeof part === 'string' && isPlainObject(curr)) {
      if (!Object.prototype.hasOwnProperty.call(curr, part)) return undefined
      curr = objValue(curr, part)
    } else if (typeof part === 'number' && Array.isArray(curr)) {
      if (part < 0 || part >= curr.length) return undefined
      curr = curr[part]!
    } else {
      return undefined
    }
  }
  return curr
}
