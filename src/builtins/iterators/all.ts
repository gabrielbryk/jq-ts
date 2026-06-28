import { RuntimeError } from '../../errors'
import { isTruthy } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const allBuiltins: BuiltinSpec[] = [
  {
    name: 'all',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('all expects an array', span)
      yield emit(input.every(isTruthy), span, tracker)
    },
  },
  {
    name: 'all',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('all expects an array', span)
      let result = true
      for (const item of input) {
        let itemResult = false
        for (const val of evaluate(args[0]!, item, env, tracker)) {
          if (isTruthy(val)) {
            itemResult = true
            break
          }
        }
        if (!itemResult) {
          result = false
          break
        }
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'all',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      let result = true
      for (const item of evaluate(args[0]!, input, env, tracker)) {
        let itemResult = false
        for (const condition of evaluate(args[1]!, item, env, tracker)) {
          if (isTruthy(condition)) {
            itemResult = true
            break
          }
        }
        if (!itemResult) {
          result = false
          break
        }
      }
      yield emit(result, span, tracker)
    },
  },
]
