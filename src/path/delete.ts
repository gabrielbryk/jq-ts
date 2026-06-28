import type { Span } from '../span'
import { isPlainObject, type Value, type ValueObject } from '../value'
import { objValue, type PathSegment } from './types'

const deleteFromObject = (root: ValueObject, paths: PathSegment[][], span: Span): Value => {
  const result: ValueObject = { ...root }
  const relevantPaths = paths.filter((p) => p.length > 0 && typeof p[0] === 'string')

  const byKey: Record<string, PathSegment[][]> = {}
  for (const p of relevantPaths) {
    const key = p[0] as string
    if (!byKey[key]) byKey[key] = []
    byKey[key].push(p.slice(1))
  }

  for (const key of Object.keys(byKey)) {
    const tails = byKey[key]!
    if (tails.some((t) => t.length === 0)) {
      delete result[key]
    } else {
      result[key] = deletePaths(objValue(root, key), tails, span)
    }
  }
  return result
}

const deleteFromArray = (root: Value[], paths: PathSegment[][], span: Span): Value => {
  const relevantPaths = paths.filter((p) => p.length > 0 && typeof p[0] === 'number')

  const actions: Record<number, PathSegment[][]> = {}
  for (const p of relevantPaths) {
    let idx = p[0] as number
    if (idx < 0) idx = root.length + idx
    if (idx < 0 || idx >= root.length) continue
    if (!actions[idx]) actions[idx] = []
    actions[idx]!.push(p.slice(1))
  }

  const finalArr: Value[] = []
  for (let i = 0; i < root.length; i++) {
    const tails = actions[i]
    if (tails) {
      if (tails.some((t) => t.length === 0)) {
        continue
      } else {
        finalArr.push(deletePaths(root[i]!, tails, span))
      }
    } else {
      finalArr.push(root[i]!)
    }
  }
  return finalArr
}

/** Returns a copy of `root` with all of the given paths removed. */
export const deletePaths = (root: Value, paths: PathSegment[][], span: Span): Value => {
  if (paths.some((p) => p.length === 0)) return null

  if (isPlainObject(root)) {
    return deleteFromObject(root, paths, span)
  }

  if (Array.isArray(root)) {
    return deleteFromArray(root, paths, span)
  }

  return root
}
