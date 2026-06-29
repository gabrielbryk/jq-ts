import { RuntimeError } from '../../errors'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const nthBuiltins: BuiltinSpec[] = [
  {
    name: 'nth',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('nth expects array input', span)
      for (const n of evaluate(args[0]!, input, env, tracker)) {
        if (typeof n !== 'number') throw new RuntimeError('nth expects number', span)
        const idx = Math.trunc(n)
        if (idx >= 0 && idx < input.length) yield emit(input[idx]!, span, tracker)
      }
    },
  },
  {
    name: 'nth',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // nth(n; expr)
      const indices = evaluate(args[0]!, input, env, tracker)
      for (const n of indices) {
        if (typeof n !== 'number') throw new RuntimeError('nth expects number', span)
        if (n < 0) throw new RuntimeError('nth index must not be negative', span)
        let count = 0
        for (const val of evaluate(args[1]!, input, env, tracker)) {
          if (count === n) {
            yield val
            break // jq nth stops at the first matching index
          }
          count++
        }
      }
    },
  },
  {
    name: 'isempty',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // isempty(expr) -> true if empty, false otherwise
      let empty = true
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of evaluate(args[0]!, input, env, tracker)) {
        empty = false
        break
      }
      yield emit(empty, span, tracker)
    },
  },
]
