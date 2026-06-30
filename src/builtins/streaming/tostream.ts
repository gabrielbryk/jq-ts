import type { LimitTracker } from '../../limits'
import type { Span } from '../../span'
import { isPlainObject, type Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

type StreamPath = (string | number)[]

/**
 * Emits the streamed form of `value` (jq's `tostream` semantics):
 * - each leaf yields `[path, leafValue]`
 * - after the last element of every non-empty array/object, a close event
 *   `[pathToLastKey]` is emitted
 * - scalars and empty containers are leaves (empty `[]`/`{}` stream as a leaf)
 *
 * Object keys follow the interpreter's canonical (sorted) ordering, matching
 * the rest of the codebase (e.g. `paths`, `recurse`).
 */
function* streamValue(
  value: Value,
  path: StreamPath,
  span: Span,
  tracker: LimitTracker
): Generator<Value> {
  if (Array.isArray(value) && value.length > 0) {
    for (let i = 0; i < value.length; i++) {
      yield* streamValue(value[i]!, [...path, i], span, tracker)
    }
    yield emit([[...path, value.length - 1]], span, tracker)
  } else if (isPlainObject(value) && Object.keys(value).length > 0) {
    const keys = Object.keys(value).sort()
    for (const key of keys) {
      yield* streamValue(value[key]!, [...path, key], span, tracker)
    }
    yield emit([[...path, keys[keys.length - 1]!]], span, tracker)
  } else {
    yield emit([path, value], span, tracker)
  }
}

export const tostreamBuiltins: BuiltinSpec[] = [
  {
    name: 'tostream',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _evaluate, span) {
      yield* streamValue(input, [], span, tracker)
    },
  },
]
