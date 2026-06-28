import { RuntimeError } from '../errors'
import type { Span } from '../span'
import { describeType, type Value } from '../value'

type UpdateFn = (val: Value | undefined) => Value | undefined

/** Applies a slice-assignment segment `{ start, end }`, replacing the range with the RHS array. */
export const updateSliceSegment = (
  root: Value,
  head: { start: number | null; end: number | null },
  updateFn: UpdateFn,
  span: Span
): Value => {
  if (!Array.isArray(root)) {
    throw new RuntimeError(`Cannot slice ${describeType(root)}`, span)
  }
  const arr = [...root]
  const start = head.start ?? 0
  const end = head.end ?? arr.length
  // In jq, slice assignment replaces the range with the RHS elements
  const oldSlice = arr.slice(start, end)
  const newSliceVal = updateFn(oldSlice)
  if (!Array.isArray(newSliceVal)) {
    throw new RuntimeError('Assignment to a slice must be an array', span)
  }
  arr.splice(start, end - start, ...newSliceVal)
  return arr
}
