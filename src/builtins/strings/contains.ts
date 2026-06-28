import type { LimitTracker } from '../../limits'
import type { Span } from '../../span'
import { isPlainObject, type Value, valueEquals } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const checkContains = (a: Value, b: Value, tracker?: LimitTracker, span?: Span): boolean => {
  if (tracker && span) tracker.step(span)
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a === 'string' && typeof b === 'string') {
    return a.includes(b)
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return b.every((bItem) => a.some((aItem) => checkContains(aItem, bItem, tracker, span)))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(b)
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(a, key)) return false
      const valA = a[key]!
      const valB = b[key]!
      if (!checkContains(valA, valB, tracker, span)) return false
    }
    return true
  }
  return valueEquals(a, b)
}

export const containsBuiltins: BuiltinSpec[] = [
  {
    name: 'contains',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const bGen = evaluate(args[0]!, input, env, tracker)
      for (const b of bGen) {
        yield emit(checkContains(input, b, tracker, span), span, tracker)
      }
    },
  },
]
