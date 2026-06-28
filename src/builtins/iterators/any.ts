import { RuntimeError } from '../../errors'
import { isTruthy } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const anyBuiltins: BuiltinSpec[] = [
  {
    name: 'any',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('any expects an array', span)
      yield emit(input.some(isTruthy), span, tracker)
    },
  },
  {
    name: 'any',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('any expects an array', span)
      let result = false
      for (const item of input) {
        for (const val of evaluate(args[0]!, item, env, tracker)) {
          if (isTruthy(val)) {
            result = true
            break
          }
        }
        if (result) break
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'any',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      let result = false
      for (const item of evaluate(args[0]!, input, env, tracker)) {
        for (const condition of evaluate(args[1]!, item, env, tracker)) {
          if (isTruthy(condition)) {
            result = true
            break
          }
        }
        if (result) break
      }
      yield emit(result, span, tracker)
    },
  },
]
