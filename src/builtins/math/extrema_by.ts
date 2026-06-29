import { RuntimeError } from '../../errors'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { gte, lt, pickExtremeBy } from './shared'

export const extremaByBuiltins: BuiltinSpec[] = [
  {
    name: 'min_by',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('min_by expects an array', span)
      if (input.length === 0) {
        yield emit(null, span, tracker)
        return
      }
      yield emit(
        pickExtremeBy(input, lt, evaluate, args, env, tracker, span, 'min_by'),
        span,
        tracker
      )
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
      yield emit(
        pickExtremeBy(input, gte, evaluate, args, env, tracker, span, 'max_by'),
        span,
        tracker
      )
    },
  },
]
