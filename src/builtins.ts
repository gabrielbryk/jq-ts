import type { FilterNode } from './ast'
import type { Span } from './span'
import { RuntimeError } from './errors'
import {
  type Value,
  type ValueObject,
  describeType,
  isTruthy,
  valueEquals,
  compareValues,
  isPlainObject,
} from './value'
import type { LimitTracker } from './limits'
import type { EnvStack } from './eval'

export type Evaluator = (
  node: FilterNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
) => Generator<Value>

export interface BuiltinSpec {
  name: string
  arity: number
  apply: (
    input: Value,
    args: FilterNode[],
    env: EnvStack,
    tracker: LimitTracker,
    evaluate: Evaluator,
    span: Span
  ) => Generator<Value>
}

const emit = (value: Value, span: Span, tracker: LimitTracker): Value => {
  tracker.emit(span)
  return value
}

// Helper: Ensure value is a number integer for array indexing
const ensureIndex = (val: Value): number | undefined => {
  if (typeof val === 'number' && Number.isInteger(val)) return val
  if (typeof val === 'string' && /^-?\d+$/.test(val)) return parseInt(val, 10)
  return undefined
}

const stableStringify = (value: Value): string => {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  // Object: sort keys
  const keys = Object.keys(value).sort()
  const entries = keys.map(
    (k) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      `${JSON.stringify(k)}:${stableStringify((value as ValueObject)[k]!)}`
  )
  return `{${entries.join(',')}}`
}

export const builtins: Record<string, BuiltinSpec> = {
  type: {
    name: 'type',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(describeType(input), span, tracker)
    },
  },
  tostring: {
    name: 'tostring',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(stableStringify(input), span, tracker)
    },
  },
  tonumber: {
    name: 'tonumber',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input === 'number') {
        yield emit(input, span, tracker)
        return
      }
      if (typeof input === 'string') {
        const num = Number(input)
        if (!Number.isFinite(num)) {
          throw new RuntimeError(`Cannot convert string "${input}" to number`, span)
        }
        yield emit(num, span, tracker)
        return
      }
      throw new RuntimeError(`Cannot convert ${describeType(input)} to number`, span)
    },
  },
  length: {
    name: 'length',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input === 'string') {
        // Use Array.from to count codepoints correctly
        yield emit(Array.from(input).length, span, tracker)
      } else if (Array.isArray(input)) {
        yield emit(input.length, span, tracker)
      } else if (input !== null && typeof input === 'object') {
        // Safe because isPlainObject check implies it's not null/array, but here we can just use Object.keys
        yield emit(Object.keys(input).length, span, tracker)
      } else {
        throw new RuntimeError(`Cannot take length of ${describeType(input)}`, span)
      }
    },
  },
  keys: {
    name: 'keys',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (Array.isArray(input)) {
        const indices = Array.from({ length: input.length }, (_, i) => i)
        yield emit(indices, span, tracker)
      } else if (input !== null && typeof input === 'object') {
        const sortedKeys = Object.keys(input).sort()
        yield emit(sortedKeys, span, tracker)
      } else {
        throw new RuntimeError(`keys expects an array or object`, span)
      }
    },
  },
  has: {
    name: 'has',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const keyFilter = args[0]!
      for (const key of evaluate(keyFilter, input, env, tracker)) {
        if (Array.isArray(input)) {
          const idx = ensureIndex(key)
          yield emit(idx !== undefined && idx >= 0 && idx < input.length, span, tracker)
        } else if (input !== null && typeof input === 'object') {
          let keyStr: string
          if (typeof key === 'string') keyStr = key
          else if (typeof key === 'number') keyStr = key.toString()
          else {
            throw new RuntimeError(`has() key must be string or number for object input`, span)
          }
          yield emit(Object.prototype.hasOwnProperty.call(input, keyStr), span, tracker)
        } else {
          throw new RuntimeError(`has() expects an array or object input`, span)
        }
      }
    },
  },
  error: {
    name: 'error',
    arity: 1,
    // eslint-disable-next-line require-yield
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const msg of evaluate(args[0]!, input, env, tracker)) {
        throw new RuntimeError(typeof msg === 'string' ? msg : stableStringify(msg), span)
      }
    },
  },
  map: {
    name: 'map',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('map expects an array', span)
      const result: Value[] = []
      const filter = args[0]!
      // Step limit: "process step"? Maybe not per element if AST handles it.
      // But we are running a loop here. The evaluate() call inside will step.
      // We should probably check limits if loop is huge?
      // The evaluate() inside handles steps.
      for (const item of input) {
        // tracker.step(span) ? Plan said "Call tracker.step(span) inside per-element loops"
        tracker.step(span)
        for (const output of evaluate(filter, item, env, tracker)) {
          result.push(output)
        }
      }
      yield emit(result, span, tracker)
    },
  },
  select: {
    name: 'select',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const filter = args[0]!
      for (const res of evaluate(filter, input, env, tracker)) {
        if (isTruthy(res)) {
          yield emit(input, span, tracker)
          // "emit original input once" if ANY output is truthy?
          // jq documentation: "select(f) produces its input calls if f returns true..."
          // If f produces multiple values, does it emit multiple times?
          // jq: `1 | select(., .)` -> `1` (checks 1), `1` (checks 1) -> yields 1, 1?
          // `echo 1 | jq 'select(true, true)'` -> `1 \n 1`.
          // So if filter yields multiple truthy values, it emits input multiple times.
          // Wait, plan says: "if any output is truthy... emit original input once; otherwise emit nothing."
          // My plan might have simplified it. Jq's behavior is typically "for each output of condition, if truthy yield input".
          // "The function `select(foo)` produces its input unchanged if `foo` returns true for that input, and produces no output otherwise."
          // Usually implies streaming.
          // Let's stick to the Plan's text for now if precise, or standard behavior.
          // Plan text: "run filter arg on input value; if any output is truthy (per isTruthy), emit original input once; otherwise emit nothing."
          // I will follow the PLAN. It says "emit original input once".
          return // Stop after first truthy?
        }
      }
    },
  },
  sort: {
    name: 'sort',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('sort expects an array', span)
      const sorted = sortStable(input, (a, b) => compareValues(a, b))
      tracker.step(span) // Accounting for the sort op itself
      yield emit(sorted, span, tracker)
    },
  },
  sort_by: {
    name: 'sort_by',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('sort_by expects an array', span)
      const filter = args[0]!
      // Compute keys
      const pairs: { val: Value; key: Value }[] = []
      for (const item of input) {
        tracker.step(span)
        const keys = Array.from(evaluate(filter, item, env, tracker))
        if (keys.length !== 1)
          throw new RuntimeError('sort_by key expression must return exactly one value', span)
        pairs.push({ val: item, key: keys[0]! })
      }
      const sorted = sortStable(pairs, (a, b) => compareValues(a.key, b.key))
      yield emit(
        sorted.map((p) => p.val),
        span,
        tracker
      )
    },
  },
  unique: {
    name: 'unique',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('unique expects an array', span)
      // "unique" in jq usually implies sorting too.
      // But Plan says: "Preserve first occurrence order; dedupe via valueEquals."
      // Actually standard jq `unique` outputs SORTED array.
      // But let's check the Plan text again carefully.
      // Plan: "unique/0: input array only. Preserve first occurrence order; dedupe via valueEquals."
      // This describes `unique_stable` or generic deduping, NOT `unique` (which sorts).
      // If the plan requested this specific behavior, I should follow it.
      // "Preserve first occurrence order" is explicit.
      const seen: Value[] = []
      const result: Value[] = []
      for (const item of input) {
        tracker.step(span) // step per item
        if (!seen.some((s) => valueEquals(s, item))) {
          seen.push(item)
          result.push(item)
        }
      }
      yield emit(result, span, tracker)
    },
  },
  unique_by: {
    name: 'unique_by',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('unique_by expects an array', span)
      const filter = args[0]!
      const seenKeys: Value[] = []
      const result: Value[] = []
      for (const item of input) {
        tracker.step(span)
        const keys = Array.from(evaluate(filter, item, env, tracker))
        if (keys.length !== 1)
          throw new RuntimeError('unique_by key expression must return exactly one value', span)
        const key = keys[0]!
        if (!seenKeys.some((s) => valueEquals(s, key))) {
          seenKeys.push(key)
          result.push(item)
        }
      }
      yield emit(result, span, tracker)
    },
  },
  to_entries: {
    name: 'to_entries',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (Array.isArray(input)) {
        const result = input.map((v, i) => ({ key: i, value: v }))
        yield emit(result, span, tracker)
      } else if (input !== null && typeof input === 'object') {
        const keys = Object.keys(input).sort()
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const result = keys.map((k) => ({ key: k, value: (input as ValueObject)[k]! }))
        yield emit(result, span, tracker)
      } else {
        throw new RuntimeError('to_entries expects array or object', span)
      }
    },
  },
  from_entries: {
    name: 'from_entries',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('from_entries expects an array', span)
      const result: ValueObject = {}
      for (const item of input) {
        tracker.step(span)
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
          throw new RuntimeError('from_entries expects array of objects', span)
        }
        const obj = item
        if (!('key' in obj) || !('value' in obj)) {
          throw new RuntimeError('from_entries items must have "key" and "value"', span)
        }
        const key = obj['key']
        if (typeof key !== 'string') {
          throw new RuntimeError('from_entries object keys must be strings', span)
        }
        result[key] = obj['value']!
      }
      yield emit(result, span, tracker)
    },
  },
  with_entries: {
    name: 'with_entries',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // to_entries
      let entries: Value[]
      if (Array.isArray(input)) {
        entries = input.map((v, i) => ({ key: i, value: v }))
      } else if (input !== null && typeof input === 'object') {
        const keys = Object.keys(input).sort()
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        entries = keys.map((k) => ({ key: k, value: (input as ValueObject)[k]! }))
      } else {
        throw new RuntimeError('with_entries expects array or object', span)
      }

      // map(f)
      const transformed: Value[] = []
      const filter = args[0]!
      for (const entry of entries) {
        tracker.step(span)
        for (const outVar of evaluate(filter, entry, env, tracker)) {
          transformed.push(outVar)
        }
      }

      // from_entries
      const result: ValueObject = {}
      for (const item of transformed) {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
          throw new RuntimeError('with_entries filter must produce objects', span)
        }
        const obj = item
        if (!('key' in obj) || !('value' in obj)) {
          throw new RuntimeError('with_entries items must have "key" and "value"', span)
        }
        const key = obj['key']
        if (typeof key !== 'string') {
          throw new RuntimeError('with_entries keys must be strings', span)
        }
        result[key] = obj['value']!
      }
      yield emit(result, span, tracker)
    },
  },
  split: {
    name: 'split',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string') throw new RuntimeError('split input must be a string', span)
      const sepGen = evaluate(args[0]!, input, env, tracker)
      for (const sep of sepGen) {
        if (typeof sep !== 'string')
          throw new RuntimeError('split separator must be a string', span)
        // Split logic
        yield emit(input.split(sep), span, tracker)
      }
    },
  },
  join: {
    name: 'join',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('join input must be an array', span)
      const sepGen = evaluate(args[0]!, input, env, tracker)
      for (const sep of sepGen) {
        if (typeof sep !== 'string') throw new RuntimeError('join separator must be a string', span)
        const parts: string[] = []
        for (const item of input) {
          if (typeof item !== 'string') {
            throw new RuntimeError(`join expects strings, but got ${describeType(item)}`, span)
          }
          parts.push(item)
        }
        yield emit(parts.join(sep), span, tracker)
      }
    },
  },
  startswith: {
    name: 'startswith',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string')
        throw new RuntimeError('startswith input must be a string', span)
      const prefixGen = evaluate(args[0]!, input, env, tracker)
      for (const prefix of prefixGen) {
        if (typeof prefix !== 'string')
          throw new RuntimeError('startswith prefix must be a string', span)
        yield emit(input.startsWith(prefix), span, tracker)
      }
    },
  },
  endswith: {
    name: 'endswith',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string') throw new RuntimeError('endswith input must be a string', span)
      const suffixGen = evaluate(args[0]!, input, env, tracker)
      for (const suffix of suffixGen) {
        if (typeof suffix !== 'string')
          throw new RuntimeError('endswith suffix must be a string', span)
        yield emit(input.endsWith(suffix), span, tracker)
      }
    },
  },
  contains: {
    name: 'contains',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const bGen = evaluate(args[0]!, input, env, tracker)
      for (const b of bGen) {
        yield emit(checkContains(input, b), span, tracker)
      }
    },
  },
  paths: {
    name: 'paths',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      // "paths": "emit all paths to leaf scalars...".
      // If input is scalar, emit `[]`.
      // If input is `{}`, emit `[]`? "empty arrays/objects".
      yield* traversePaths(input, [], span, tracker)
    },
  },
  getpath: {
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
  setpath: {
    name: 'setpath',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // args[0] is path, args[1] is value
      const paths = Array.from(evaluate(args[0]!, input, env, tracker))
      const values = Array.from(evaluate(args[1]!, input, env, tracker))
      for (const pathVal of paths) {
        const path = ensurePath(pathVal, span)
        for (const val of values) {
          const res = updatePath(input, path, () => val, span)
          yield emit(res ?? null, span, tracker) // Should not return undefined for setpath
        }
      }
    },
  },
  delpaths: {
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
}

const checkContains = (a: Value, b: Value): boolean => {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a === 'string' && typeof b === 'string') {
    return a.includes(b)
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return b.every((bItem) => a.some((aItem) => checkContains(aItem, bItem)))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(b)
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(a, key)) return false
      const valA = a[key]!
      const valB = b[key]!
      if (!checkContains(valA, valB)) return false
    }
    return true
  }
  return valueEquals(a, b)
}

/**
 * Recursively traverses a JSON value to find all paths to leaf nodes.
 * Yields paths as arrays of strings/numbers.
 */
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

// Logic to check if we should emit path (redundant if traversePaths handles logic)
// Removed from usage above.

const isPath = (val: Value): val is (string | number)[] => {
  if (!Array.isArray(val)) return false
  return val.every((p) => typeof p === 'string' || (typeof p === 'number' && Number.isInteger(p)))
}

const ensurePath = (val: Value, span: Span): (string | number)[] => {
  if (isPath(val)) return val
  throw new RuntimeError('Path must be an array of strings or integers', span)
}

const getPath = (root: Value, path: (string | number)[]): Value | undefined => {
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

/**
 * Immutably updates a value at a given path.
 * Creates intermediate objects/arrays as needed.
 */
const updatePath = (
  root: Value,
  path: (string | number)[],
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
      // This branch is for setpath returning undefined?
      // setpath never returns undefined from leaf.
      // If `updatePath` is used for `delpaths` (splice), we need different logic.
      // But `setpath` uses this.
      // If leaf returns undefined (delete), we delete.
      // But `setpath` typically sets to null if null passed? No, `setpath(p, null)` sets to `null`.
      // `setpath` implies leaf returns Value.
      // But if `updatePath` supports deletions...
      // For array, standard `path[i] = undefined` behavior?
      // We'll treat undefined as "do not set" or "hole"?
      // `setpath` behavior: set to value.
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

  throw new RuntimeError(`Path segment must be string or integer`, span)
}

const deletePaths = (root: Value, paths: (string | number)[][], span: Span): Value => {
  // Collect paths relevant to this level
  // Group by head
  // Paths ending here (empty tail) -> means delete this node?
  // If root is object:
  //   Filter paths that are for this object (strings).
  //   Reconstruct object excluding deleted keys, and recursing on others.

  // Check if any path is empty -> means delete ROOT.
  if (paths.some((p) => p.length === 0)) return null // Or undefined? delpaths returns ??
  // delpaths on root? `null | delpaths([[]])` -> null?
  // `1 | delpaths([[]])` -> 1? or null?
  // If we delete the root, what do we return?
  // Usually delpaths is structural.
  // If we delete root, maybe return null.

  if (isPlainObject(root)) {
    const result: ValueObject = { ...root }
    const relevantPaths = paths.filter((p) => p.length > 0 && typeof p[0] === 'string')

    // Group by key
    const byKey: Record<string, (string | number)[][]> = {}
    for (const p of relevantPaths) {
      const key = p[0] as string
      if (!byKey[key]) byKey[key] = []
      byKey[key].push(p.slice(1))
    }

    for (const key of Object.keys(byKey)) {
      const tails = byKey[key]!
      if (tails.some((t) => t.length === 0)) {
        // Delete this key
        delete result[key]
      } else {
        // Recurse
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        result[key] = deletePaths((root as ValueObject)[key]!, tails, span)
      }
    }
    return result
  }

  if (Array.isArray(root)) {
    const relevantPaths = paths.filter((p) => p.length > 0 && typeof p[0] === 'number')

    // Mark indices to delete or recurse
    // We cannot simply splice because indices shift.
    // We map original indices to actions.
    const actions: Record<number, (string | number)[][]> = {}
    for (const p of relevantPaths) {
      let idx = p[0] as number
      if (idx < 0) idx = root.length + idx
      if (idx < 0 || idx >= root.length) continue // Ignore OOB
      if (!actions[idx]) actions[idx] = []
      actions[idx]!.push(p.slice(1))
    }

    // Construct new array
    const finalArr: Value[] = []
    for (let i = 0; i < root.length; i++) {
      const tails = actions[i]
      if (tails) {
        if (tails.some((t) => t.length === 0)) {
          // Delete this element (skip push)
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

// Helper for stable sort
function sortStable<T>(arr: T[], compare: (a: T, b: T) => number): T[] {
  return arr
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const cmp = compare(a.item, b.item)
      return cmp !== 0 ? cmp : a.index - b.index
    })
    .map((p) => p.item)
}
