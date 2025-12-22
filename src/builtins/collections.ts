import { RuntimeError } from '../errors'
import { compareValues, isTruthy, valueEquals, type Value, type ValueObject } from '../value'
import { checkContains } from './strings'
import type { BuiltinSpec } from './types'
import { emit, ensureIndex } from './utils'

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

export const collectionBuiltins: BuiltinSpec[] = [
  {
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
  {
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
  {
    name: 'map',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('map expects an array', span)
      const result: Value[] = []
      const filter = args[0]!
      for (const item of input) {
        tracker.step(span)
        for (const output of evaluate(filter, item, env, tracker)) {
          result.push(output)
        }
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'select',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const filter = args[0]!
      for (const res of evaluate(filter, input, env, tracker)) {
        if (isTruthy(res)) {
          yield emit(input, span, tracker)
          return
        }
      }
    },
  },
  {
    name: 'sort',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('sort expects an array', span)
      const sorted = sortStable(input, (a, b) => compareValues(a, b))
      tracker.step(span) // Accounting for the sort op itself
      yield emit(sorted, span, tracker)
    },
  },
  {
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
  {
    name: 'unique',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('unique expects an array', span)
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
  {
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
  {
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
  {
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
  {
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
  {
    name: 'group_by',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('group_by expects an array', span)
      // 1. Evaluate keys
      const pairs: { val: Value; key: Value }[] = []
      const filter = args[0]!
      for (const item of input) {
        tracker.step(span)
        const keys = Array.from(evaluate(filter, item, env, tracker))
        if (keys.length !== 1)
          throw new RuntimeError('group_by key expression must return exactly one value', span)
        pairs.push({ val: item, key: keys[0]! })
      }
      // 2. Sort by keys
      const sorted = sortStable(pairs, (a, b) => compareValues(a.key, b.key))

      // 3. Group
      const groups: Value[][] = []
      if (sorted.length > 0) {
        let currentGroup: Value[] = [sorted[0]!.val]
        let currentKey = sorted[0]!.key
        for (let i = 1; i < sorted.length; i++) {
          const pair = sorted[i]!
          if (compareValues(pair.key, currentKey) === 0) {
            currentGroup.push(pair.val)
          } else {
            groups.push(currentGroup)
            currentGroup = [pair.val]
            currentKey = pair.key
          }
        }
        groups.push(currentGroup)
      }
      yield emit(groups, span, tracker)
    },
  },
  {
    name: 'reverse',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('reverse expects an array', span)
      yield emit([...input].reverse(), span, tracker)
    },
  },
  {
    name: 'flatten',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('flatten expects an array', span)
      const flattenRec = (arr: Value[]): Value[] => {
        let res: Value[] = []
        for (const item of arr) {
          if (Array.isArray(item)) {
            res = res.concat(flattenRec(item))
          } else {
            res.push(item)
          }
        }
        return res
      }
      yield emit(flattenRec(input), span, tracker)
    },
  },
  {
    name: 'flatten',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('flatten expects an array', span)
      const depths = evaluate(args[0]!, input, env, tracker)
      for (const depthVal of depths) {
        if (typeof depthVal !== 'number')
          throw new RuntimeError('flatten depth must be a number', span)
        const flattenDepth = (arr: Value[], d: number): Value[] => {
          if (d <= 0) return arr
          let res: Value[] = []
          for (const item of arr) {
            if (Array.isArray(item)) {
              res = res.concat(flattenDepth(item, d - 1))
            } else {
              res.push(item)
            }
          }
          return res
        }
        yield emit(flattenDepth(input, depthVal), span, tracker)
      }
    },
  },
  {
    name: 'keys_unsorted',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (Array.isArray(input)) {
        const indices = Array.from({ length: input.length }, (_, i) => i)
        yield emit(indices, span, tracker)
      } else if (input !== null && typeof input === 'object') {
        const keys = Object.keys(input)
        yield emit(keys, span, tracker)
      } else {
        throw new RuntimeError(`keys_unsorted expects an array or object`, span)
      }
    },
  },
  {
    name: 'transpose',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('transpose expects an array', span)
      const arr = input as Value[]
      if (arr.length === 0) {
        yield emit([], span, tracker)
        return
      }
      // Calculate max length
      let maxLen = 0
      for (const row of arr) {
        if (!Array.isArray(row))
          throw new RuntimeError('transpose input must be array of arrays', span)
        if (row.length > maxLen) maxLen = row.length
      }

      const result: Value[][] = []
      for (let j = 0; j < maxLen; j++) {
        const newRow: Value[] = []
        for (let i = 0; i < arr.length; i++) {
          const row = arr[i] as Value[]
          const val = j < row.length ? row[j]! : null
          newRow.push(val)
        }
        result.push(newRow)
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'bsearch',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('bsearch expects an array', span)
      const targetGen = evaluate(args[0]!, input, env, tracker)
      for (const target of targetGen) {
        let low = 0
        let high = input.length - 1
        let idx = -1
        while (low <= high) {
          const mid = Math.floor((low + high) / 2)
          const cmp = compareValues(input[mid]!, target)
          if (cmp === 0) {
            idx = mid
            break
          } else if (cmp < 0) {
            low = mid + 1
          } else {
            high = mid - 1
          }
        }
        if (idx !== -1) {
          yield emit(idx, span, tracker)
        } else {
          yield emit(-low - 1, span, tracker)
        }
      }
    },
  },
  {
    name: 'combinations',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('combinations expects an array', span)
      if (input.some((x) => !Array.isArray(x)))
        throw new RuntimeError('combinations input must be array of arrays', span)

      const arrays = input as Value[][]
      if (arrays.length === 0) {
        yield emit([], span, tracker)
        return
      }

      const helper = function* (idx: number, current: Value[]): Generator<Value[]> {
        if (idx === arrays.length) {
          yield [...current]
          return
        }
        const arr = arrays[idx]!
        if (arr.length === 0) return
        for (const item of arr) {
          current.push(item)
          yield* helper(idx + 1, current)
          current.pop()
        }
      }

      for (const combo of helper(0, [])) {
        yield emit(combo, span, tracker)
      }
    },
  },
  {
    name: 'combinations',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('combinations expects an array', span)
      const nGen = evaluate(args[0]!, input, env, tracker)
      for (const nVal of nGen) {
        if (typeof nVal !== 'number')
          throw new RuntimeError('combinations(n) expects n to be number', span)

        if (nVal === 0) {
          yield emit([], span, tracker)
          continue
        }
        const arrays: Value[][] = []
        for (let i = 0; i < nVal; i++) arrays.push(input)

        const helper = function* (idx: number, current: Value[]): Generator<Value[]> {
          if (idx === arrays.length) {
            yield [...current]
            return
          }
          const arr = arrays[idx]!
          for (const item of arr) {
            current.push(item)
            yield* helper(idx + 1, current)
            current.pop()
          }
        }
        if (input.length === 0 && nVal > 0) {
          // empty
        } else {
          for (const combo of helper(0, [])) {
            yield emit(combo, span, tracker)
          }
        }
      }
    },
  },
  {
    name: 'inside',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const bGen = evaluate(args[0]!, input, env, tracker)
      for (const b of bGen) {
        yield emit(checkContains(b, input), span, tracker)
      }
    },
  },
]
