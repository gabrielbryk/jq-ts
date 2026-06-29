import { RuntimeError } from '../../errors'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const roundingBuiltins: BuiltinSpec[] = [
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
      // jq uses "round half away from zero"; Math.round uses "round half toward +∞"
      yield emit(Math.sign(input) * Math.round(Math.abs(input)), span, tracker)
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
      const result = Math.sqrt(input)
      // jq delegates to libm sqrt(); negative input → C NaN → serialized as null
      yield emit(Number.isNaN(result) ? null : result, span, tracker)
    },
  },
]
