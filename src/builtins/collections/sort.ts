import { RuntimeError } from '../../errors'
import { compareValues, type Value, valueEquals } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { sortStable } from './sortStable'

export const sortBuiltins: BuiltinSpec[] = [
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
]
