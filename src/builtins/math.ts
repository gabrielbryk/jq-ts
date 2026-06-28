import { RuntimeError } from '../errors'
import { add } from '../eval/ops'
import { compareValues, type Value } from '../value'
import type { BuiltinSpec } from './types'
import { emit } from './utils'

/** Smallest positive normal IEEE-754 double. */
const MIN_NORMAL_DOUBLE = 2.2250738585072014e-308

/** Returns true when input is a non-zero finite number. */
const isNormalNumber = (input: Value): boolean =>
  typeof input === 'number' && Number.isFinite(input) && input !== 0

export const mathBuiltins: BuiltinSpec[] = [
  // --- Basic Math ---
  {
    name: 'floor',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'number') throw new RuntimeError('floor expects number', span)
      yield emit(Math.floor(input), span, tracker)
    },
  },
  {
    name: 'ceil',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'number') throw new RuntimeError('ceil expects number', span)
      yield emit(Math.ceil(input), span, tracker)
    },
  },
  {
    name: 'round',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'number') throw new RuntimeError('round expects number', span)
      yield emit(Math.round(input), span, tracker)
    },
  },
  {
    name: 'abs',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'number') throw new RuntimeError('abs expects number', span)
      yield emit(Math.abs(input), span, tracker)
    },
  },
  {
    name: 'sqrt',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'number') throw new RuntimeError('sqrt expects number', span)
      yield emit(Math.sqrt(input), span, tracker)
    },
  },
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

  // --- Aggregators ---
  {
    name: 'min',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('min expects an array', span)
      if (input.length === 0) {
        yield emit(null, span, tracker)
        return
      }
      let minVal = input[0]!
      for (let i = 1; i < input.length; i++) {
        if (compareValues(input[i]!, minVal) < 0) {
          minVal = input[i]!
        }
      }
      yield emit(minVal, span, tracker)
    },
  },
  {
    name: 'max',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('max expects an array', span)
      if (input.length === 0) {
        yield emit(null, span, tracker)
        return
      }
      let maxVal = input[0]!
      for (let i = 1; i < input.length; i++) {
        if (compareValues(input[i]!, maxVal) > 0) {
          maxVal = input[i]!
        }
      }
      yield emit(maxVal, span, tracker)
    },
  },
  {
    name: 'min_by',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('min_by expects an array', span)
      if (input.length === 0) {
        yield emit(null, span, tracker)
        return
      }
      let minItem = input[0]!
      let minKey: Value | undefined

      // Calculate key for first item
      // Note: evaluate returns generator. We take first? "key expression must return exactly one value" typically.
      const keys0 = Array.from(evaluate(args[0]!, minItem, env, tracker))
      if (keys0.length !== 1) throw new RuntimeError('min_by key must return one value', span)
      minKey = keys0[0]!

      for (let i = 1; i < input.length; i++) {
        const item = input[i]!
        const keys = Array.from(evaluate(args[0]!, item, env, tracker))
        if (keys.length !== 1) throw new RuntimeError('min_by key must return one value', span)
        const key = keys[0]!

        if (compareValues(key, minKey) < 0) {
          minKey = key
          minItem = item
        }
      }
      yield emit(minItem, span, tracker)
    },
  },
  {
    name: 'max_by',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('max_by expects an array', span)
      if (input.length === 0) {
        yield emit(null, span, tracker)
        return
      }
      let maxItem = input[0]!
      let maxKey: Value | undefined

      const keys0 = Array.from(evaluate(args[0]!, maxItem, env, tracker))
      if (keys0.length !== 1) throw new RuntimeError('max_by key must return one value', span)
      maxKey = keys0[0]!

      for (let i = 1; i < input.length; i++) {
        const item = input[i]!
        const keys = Array.from(evaluate(args[0]!, item, env, tracker))
        if (keys.length !== 1) throw new RuntimeError('max_by key must return one value', span)
        const key = keys[0]!

        if (compareValues(key, maxKey) > 0) {
          maxKey = key
          maxItem = item
        }
      }
      yield emit(maxItem, span, tracker)
    },
  },
  {
    name: 'add',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) {
        throw new RuntimeError('add expects an array', span)
      }
      if (input.length === 0) {
        yield emit(null, span, tracker)
        return
      }
      let acc: Value = input[0]!
      for (let i = 1; i < input.length; i++) {
        tracker.step(span)
        acc = add(acc, input[i]!, span)
      }
      yield emit(acc, span, tracker)
    },
  },
  {
    name: 'add',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const values = Array.from(evaluate(args[0]!, input, env, tracker))
      if (values.length === 0) {
        yield emit(null, span, tracker)
        return
      }
      let acc: Value = values[0]!
      for (let i = 1; i < values.length; i++) {
        tracker.step(span)
        acc = add(acc, values[i]!, span)
      }
      yield emit(acc, span, tracker)
    },
  },
]
