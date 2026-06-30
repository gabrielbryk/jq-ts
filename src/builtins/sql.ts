import { RuntimeError } from '../errors'
import { type Value, valueEquals, type ValueObject } from '../value'
import type { BuiltinSpec } from './types'
import { emit, stableStringify } from './utils'

/** jq tostring semantics: strings pass through, everything else is JSON-encoded. */
const toKey = (value: Value): string => {
  if (typeof value === 'string') return value
  return stableStringify(value)
}

export const sqlBuiltins: BuiltinSpec[] = [
  /**
   * INDEX(idx_expr) — input must be an array.
   * Builds an object keyed by tostring(idx_expr) → element (last wins on dup keys).
   */
  {
    name: 'INDEX',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('INDEX/1 expects an array input', span)
      const result: ValueObject = {}
      const filter = args[0]!
      for (const item of input) {
        tracker.step(span)
        const keys = Array.from(evaluate(filter, item, env, tracker))
        if (keys.length !== 1)
          throw new RuntimeError('INDEX key expression must return exactly one value', span)
        result[toKey(keys[0]!)] = item
      }
      yield emit(result, span, tracker)
    },
  },

  /**
   * INDEX(stream; idx_expr) — iterates stream, keys each element by idx_expr.
   * Last duplicate key wins (matches jq behaviour).
   */
  {
    name: 'INDEX',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const result: ValueObject = {}
      for (const item of evaluate(args[0]!, input, env, tracker)) {
        tracker.step(span)
        const keys = Array.from(evaluate(args[1]!, item, env, tracker))
        if (keys.length !== 1)
          throw new RuntimeError('INDEX key expression must return exactly one value', span)
        result[toKey(keys[0]!)] = item
      }
      yield emit(result, span, tracker)
    },
  },

  /**
   * IN(stream) — true if input equals any value produced by stream.
   * Equivalent to jq: . as $x | first(if stream == $x then true else empty end) // false
   */
  {
    name: 'IN',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      let found = false
      for (const candidate of evaluate(args[0]!, input, env, tracker)) {
        tracker.step(span)
        if (valueEquals(candidate, input)) {
          found = true
          break
        }
      }
      yield emit(found, span, tracker)
    },
  },

  /**
   * IN(src; s) — true if any value produced by s is present in the src stream.
   * Equivalent to jq: any(src; . == s)
   * Returns a single boolean (s may generate multiple values; any match → true).
   */
  {
    name: 'IN',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      let found = false
      outer: for (const srcVal of evaluate(args[0]!, input, env, tracker)) {
        tracker.step(span)
        for (const sVal of evaluate(args[1]!, input, env, tracker)) {
          if (valueEquals(srcVal, sVal)) {
            found = true
            break outer
          }
        }
      }
      yield emit(found, span, tracker)
    },
  },
]
