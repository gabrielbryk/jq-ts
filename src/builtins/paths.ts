import { RuntimeError } from '../errors'
import { describeType, isPlainObject, type Value, type ValueObject } from '../value'
import type { Span } from '../span'
import type { LimitTracker } from '../limits'
import type { BuiltinSpec } from './types'
import { evaluatePath } from '../eval/path_eval'
import { emit } from './utils'

export type PathSegment = string | number | { start: number | null; end: number | null }

// --- Internal Path Logic ---

function* traversePaths(
  root: Value,
  currentPath: (string | number)[],
  span: Span,
  tracker: LimitTracker
): Generator<Value> {
  tracker.step(span)
  const isLeaf =
    root === null ||
    typeof root !== 'object' ||
    (Array.isArray(root) && root.length === 0) ||
    (isPlainObject(root) && Object.keys(root).length === 0)

  if (isLeaf) {
    yield emit([...currentPath], span, tracker)
    return
  }

  if (Array.isArray(root)) {
    for (let i = 0; i < root.length; i++) {
      yield* traversePaths(root[i]!, [...currentPath, i], span, tracker)
    }
  } else if (isPlainObject(root)) {
    const keys = Object.keys(root).sort()
    for (const key of keys) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      yield* traversePaths((root as ValueObject)[key]!, [...currentPath, key], span, tracker)
    }
  }
}

const isPath = (val: Value): val is PathSegment[] => {
  if (!Array.isArray(val)) return false
  return val.every(
    (p) =>
      typeof p === 'string' ||
      (typeof p === 'number' && Number.isInteger(p)) ||
      (isPlainObject(p) && ('start' in p || 'end' in p))
  )
}

export const ensurePath = (val: Value, span: Span): PathSegment[] => {
  if (isPath(val)) return val
  throw new RuntimeError('Path must be an array of strings, integers, or slice objects', span)
}

export const getPath = (root: Value, path: PathSegment[]): Value | undefined => {
  let curr = root
  for (const part of path) {
    if (curr === null) return undefined
    if (typeof part === 'string' && isPlainObject(curr)) {
      if (!Object.prototype.hasOwnProperty.call(curr, part)) return undefined
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      curr = (curr as ValueObject)[part]!
    } else if (typeof part === 'number' && Array.isArray(curr)) {
      if (part < 0 || part >= curr.length) return undefined
      curr = curr[part]!
    } else {
      return undefined
    }
  }
  return curr
}

export const updatePath = (
  root: Value,
  path: PathSegment[],
  updateFn: (val: Value | undefined) => Value | undefined,
  span: Span,
  depth = 0
): Value | undefined => {
  if (path.length === 0) {
    return updateFn(root)
  }
  const [head, ...tail] = path

  if (typeof head === 'string') {
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

  if (typeof head === 'number') {
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

    if (newVal === undefined) {
      if (idx >= arr.length) {
        while (arr.length < idx) arr.push(null)
        arr.push(newVal!)
      } else {
        arr[idx] = newVal!
      }
    } else {
      if (idx >= arr.length) {
        while (arr.length < idx) arr.push(null)
        arr.push(newVal)
      } else {
        arr[idx] = newVal
      }
    }
    return arr
  }

  if (typeof head === 'object' && head !== null) {
    // Slice assignment: { start: number | null, end: number | null }
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

  throw new RuntimeError(`Path segment must be string, integer, or slice object`, span)
}

export const deletePaths = (root: Value, paths: PathSegment[][], span: Span): Value => {
  if (paths.some((p) => p.length === 0)) return null

  if (isPlainObject(root)) {
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        result[key] = deletePaths((root as ValueObject)[key]!, tails, span)
      }
    }
    return result
  }

  if (Array.isArray(root)) {
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

  return root
}

// --- Builtin Exports ---

export const pathBuiltins: BuiltinSpec[] = [
  {
    name: 'paths',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield* traversePaths(input, [], span, tracker)
    },
  },
  {
    name: 'getpath',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const pathVal of evaluate(args[0]!, input, env, tracker)) {
        const path = ensurePath(pathVal, span)
        const res = getPath(input, path)
        yield emit(res ?? null, span, tracker)
      }
    },
  },
  {
    name: 'setpath',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const paths = Array.from(evaluate(args[0]!, input, env, tracker))
      const values = Array.from(evaluate(args[1]!, input, env, tracker))
      for (const pathVal of paths) {
        const path = ensurePath(pathVal, span)
        for (const val of values) {
          const res = updatePath(input, path, () => val, span)
          yield emit(res ?? null, span, tracker)
        }
      }
    },
  },
  {
    name: 'delpaths',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const pathsVal of evaluate(args[0]!, input, env, tracker)) {
        if (!Array.isArray(pathsVal))
          throw new RuntimeError('delpaths expects an array of paths', span)
        const paths = pathsVal.map((p) => ensurePath(p, span))
        const res = deletePaths(input, paths, span)
        yield emit(res, span, tracker)
      }
    },
  },
  {
    name: 'path',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // path(expr) returns the path array of the expression
      // We use evaluatePath logic
      for (const p of evaluatePath(args[0]!, input, env, tracker, evaluate)) {
        yield emit(p, span, tracker)
      }
    },
  },
]
