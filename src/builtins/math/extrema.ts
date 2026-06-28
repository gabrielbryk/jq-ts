import { RuntimeError } from '../../errors'
import { compareValues, type Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { gt, lt } from './shared'

/** Pick the item whose comparison against the running best satisfies `keep`. */
const pickExtreme = (input: Value[], keep: (cmp: number) => boolean): Value => {
  let best = input[0]!
  for (let i = 1; i < input.length; i++) {
    if (keep(compareValues(input[i]!, best))) best = input[i]!
  }
  return best
}

export const extremaBuiltins: BuiltinSpec[] = [
  {
    name: 'min',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('min expects an array', span)
      if (input.length === 0) {
        yield emit(null, span, tracker)
        return
      }
      yield emit(pickExtreme(input, lt), span, tracker)
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
      yield emit(pickExtreme(input, gt), span, tracker)
    },
  },
]
