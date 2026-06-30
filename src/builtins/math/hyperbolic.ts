import { RuntimeError } from '../../errors'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

const unary = (name: string, fn: (x: number) => number): BuiltinSpec => ({
  name,
  arity: 0,
  apply: function* (input, _args, _env, tracker, _eval, span) {
    if (typeof input !== 'number') throw new RuntimeError(`${name} requires a number`, span)
    const r = fn(input)
    yield emit(Number.isNaN(r) ? null : r, span, tracker)
  },
})

export const hyperbolicBuiltins: BuiltinSpec[] = [
  unary('sinh', Math.sinh),
  unary('cosh', Math.cosh),
  unary('tanh', Math.tanh),
  unary('asinh', Math.asinh),
  unary('acosh', Math.acosh),
  unary('atanh', Math.atanh),
]
