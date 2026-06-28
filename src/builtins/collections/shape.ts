import { RuntimeError } from '../../errors'
import type { Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const shapeBuiltins: BuiltinSpec[] = [
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
          tracker.step(span)
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
            tracker.step(span)
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
    name: 'transpose',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('transpose expects an array', span)
      const arr = input
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
]
