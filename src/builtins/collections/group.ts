import { RuntimeError } from '../../errors'
import { compareValues, type Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { sortStable } from './sortStable'

export const groupBuiltins: BuiltinSpec[] = [
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
]
