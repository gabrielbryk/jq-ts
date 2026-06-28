import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { isNormalNumber, MIN_NORMAL_DOUBLE } from './shared'

export const finitenessBuiltins: BuiltinSpec[] = [
  {
    name: 'isfinite',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'number') {
        yield emit(true, span, tracker) // jq `isfinite("foo")` -> true. Only numbers can be infinite.
        return
      }
      yield emit(Number.isFinite(input), span, tracker)
    },
  },
  {
    // normal is a non-standard alias for isnormal in this implementation.
    name: 'normal',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(isNormalNumber(input), span, tracker)
    },
  },
  {
    name: 'isnormal',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(isNormalNumber(input), span, tracker)
    },
  },
  {
    name: 'subnormal',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      // A subnormal is a non-zero finite number smaller in magnitude than the
      // smallest positive normal double (2.2250738585072014e-308).
      const isSubnormal =
        typeof input === 'number' &&
        input !== 0 &&
        Number.isFinite(input) &&
        Math.abs(input) < MIN_NORMAL_DOUBLE
      yield emit(isSubnormal, span, tracker)
    },
  },
]
