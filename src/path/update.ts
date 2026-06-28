import { RuntimeError } from '../errors'
import type { Span } from '../span'
import { describeType, isPlainObject, type Value } from '../value'
import type { PathSegment } from './types'
import { updateSliceSegment } from './update-slice'

type UpdateFn = (val: Value | undefined) => Value | undefined

const updateObjectSegment = (
  root: Value,
  head: string,
  tail: PathSegment[],
  updateFn: UpdateFn,
  span: Span,
  depth: number
): Value => {
  let obj: Record<string, Value> = {}
  if (isPlainObject(root)) {
    obj = { ...root }
  } else if (root === null) {
    obj = {}
  } else {
    throw new RuntimeError(`Cannot index ${describeType(root)} with string "${head}"`, span)
  }

  const child = Object.prototype.hasOwnProperty.call(obj, head) ? obj[head]! : undefined
  const newVal = updatePath(child ?? null, tail, updateFn, span, depth + 1)
  if (newVal === undefined) {
    delete obj[head]
  } else {
    obj[head] = newVal
  }
  return obj
}

const updateArraySegment = (
  root: Value,
  head: number,
  tail: PathSegment[],
  updateFn: UpdateFn,
  span: Span,
  depth: number
): Value => {
  let arr: Value[] = []
  if (Array.isArray(root)) {
    arr = [...root]
  } else if (root === null) {
    arr = []
  } else {
    throw new RuntimeError(`Cannot index ${describeType(root)} with number ${head}`, span)
  }

  const idx = head < 0 ? arr.length + head : head
  if (idx < 0) throw new RuntimeError('Invalid negative index', span)

  const child = idx < arr.length ? arr[idx] : null
  const newVal = updatePath(child ?? null, tail, updateFn, span, depth + 1)

  if (idx >= arr.length) {
    while (arr.length < idx) arr.push(null)
    arr.push(newVal as Value)
  } else {
    arr[idx] = newVal as Value
  }
  return arr
}

/** Returns a copy of `root` with the value at `path` transformed by `updateFn`. */
export const updatePath = (
  root: Value,
  path: PathSegment[],
  updateFn: UpdateFn,
  span: Span,
  depth = 0
): Value | undefined => {
  if (path.length === 0) {
    return updateFn(root)
  }
  const [head, ...tail] = path

  if (typeof head === 'string') {
    return updateObjectSegment(root, head, tail, updateFn, span, depth)
  }

  if (typeof head === 'number') {
    return updateArraySegment(root, head, tail, updateFn, span, depth)
  }

  if (typeof head === 'object' && head !== null) {
    return updateSliceSegment(root, head, updateFn, span)
  }

  throw new RuntimeError(`Path segment must be string, integer, or slice object`, span)
}
