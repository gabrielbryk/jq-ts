import { RuntimeError } from '../../errors'
import { add } from '../../eval/ops'
import type { Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import type { Span, Tracker } from './shared'

/** Sum a stream of values using jq's polymorphic `add`. */
const sumValues = (values: Value[], tracker: Tracker, span: Span): Value => {
  let acc: Value = values[0]!
  for (let i = 1; i < values.length; i++) {
    tracker.step(span)
    acc = add(acc, values[i]!, span)
  }
  return acc
}

export const sumBuiltins: BuiltinSpec[] = [
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
      yield emit(sumValues(input, tracker, span), span, tracker)
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
      yield emit(sumValues(values, tracker, span), span, tracker)
    },
  },
]
