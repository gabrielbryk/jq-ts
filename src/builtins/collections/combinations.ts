import { RuntimeError } from '../../errors'
import type { Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const combinationBuiltins: BuiltinSpec[] = [
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
        for (const combo of helper(0, [])) {
          yield emit(combo, span, tracker)
        }
      }
    },
  },
]
