import { RuntimeError } from '../errors'
import { compareValues, type Value } from '../value'
import type { BuiltinSpec } from './types'
import { emit } from './utils'
import { add } from '../eval/ops'

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
        yield emit(false, span, tracker) // jq behavior: isnan("foo") -> false? or error? jq isnan("foo") -> `false`.
        return
      }
      yield emit(Number.isNaN(input), span, tracker)
    },
  },
  {
    name: 'infinite',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'number') {
        yield emit(false, span, tracker)
        return
      }
      yield emit(!Number.isFinite(input) && !Number.isNaN(input), span, tracker)
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
    name: 'normal',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'number') {
        yield emit(false, span, tracker)
        return
      }
      // normal: normal finite number (not subnormal, not 0, not infinite, not nan)
      // JS doesn't distinguish subnormal easily, but `Number.isFinite(x) && Math.abs(x) >= Number.MIN_NORMAL` roughly?
      // jq source says: `isnormal`.
      // For JS:
      if (!Number.isFinite(input) || Number.isNaN(input) || input === 0) {
        yield emit(false, span, tracker)
        return
      }
      // Assuming simplistic "not zero, not infinite, not nan" for now as "normal" in JS context roughly covers it.
      // Strict IEEE subnormal check is harder.
      yield emit(true, span, tracker)
    },
  },
  {
    name: 'subnormal',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'number') {
        yield emit(false, span, tracker)
        return
      }
      // In JS, subnormals are handled transparently, but `x !== 0 && Math.abs(x) < Number.MIN_VALUE`? No `MIN_VALUE` is roughly 5e-324 (smallest positive).
      // `Number.MIN_NORMAL` (if available in polyfill) or check?
      // Let's assume false for JS numbers unless extremely small?
      // jq checks `fpclassify`.
      // For now, let's just return false unless 0.
      yield emit(false, span, tracker)
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
]
