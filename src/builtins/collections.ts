import { RuntimeError } from '../errors'
import { compareValues, isTruthy, valueEquals, type Value, type ValueObject } from '../value'
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
]
