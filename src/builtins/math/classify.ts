import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const classifyBuiltins: BuiltinSpec[] = [
  {
    name: 'isnan',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'number') {
        // jq treats non-numbers as not NaN: isnan("foo") -> false.
        yield emit(false, span, tracker)
        return
      }
      yield emit(Number.isNaN(input), span, tracker)
    },
  },
  {
    name: 'infinite',
    arity: 0,
    apply: function* (_input, _args, _env, tracker, _eval, span) {
      yield emit(Infinity, span, tracker)
    },
  },
  {
    name: 'nan',
    arity: 0,
    apply: function* (_input, _args, _env, tracker, _eval, span) {
      yield emit(NaN, span, tracker)
    },
  },
  {
    name: 'isinfinite',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(
        typeof input === 'number' && !Number.isFinite(input) && !Number.isNaN(input),
        span,
        tracker
      )
    },
  },
]
