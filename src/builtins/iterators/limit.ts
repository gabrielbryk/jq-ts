import { RuntimeError } from '../../errors'
import type { Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const limitBuiltins: BuiltinSpec[] = [
  {
    name: 'limit',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // limit(n; expr)
      const limits = evaluate(args[0]!, input, env, tracker)
      for (const n of limits) {
        if (typeof n !== 'number') throw new RuntimeError('limit expects number', span)
        let count = 0
        if (n > 0) {
          for (const val of evaluate(args[1]!, input, env, tracker)) {
            yield val // val is already emitted by expr
            count++
            if (count >= n) break
          }
        }
      }
    },
  },
  {
    name: 'skip',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const n of evaluate(args[0]!, input, env, tracker)) {
        if (typeof n !== 'number') throw new RuntimeError('skip expects number', span)
        let count = 0
        for (const val of evaluate(args[1]!, input, env, tracker)) {
          if (count >= n) yield val
          count++
        }
      }
    },
  },
  {
    name: 'first',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (Array.isArray(input) && input.length > 0) yield emit(input[0]!, span, tracker)
    },
  },
  {
    name: 'first',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate) {
      // first(expr) -> limit(1; expr)
      for (const val of evaluate(args[0]!, input, env, tracker)) {
        yield val
        break
      }
    },
  },
  {
    name: 'last',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (Array.isArray(input) && input.length > 0)
        yield emit(input[input.length - 1]!, span, tracker)
    },
  },
  {
    name: 'last',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate) {
      // last(expr): the final output of expr
      let lastVal: Value | undefined
      let found = false
      for (const val of evaluate(args[0]!, input, env, tracker)) {
        lastVal = val
        found = true
      }
      if (found) yield lastVal as Value
    },
  },
]
