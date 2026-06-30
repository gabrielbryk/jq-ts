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

export const explogBuiltins: BuiltinSpec[] = [
  unary('exp', Math.exp),
  unary('expm1', Math.expm1),
  unary('exp2', (x) => 2 ** x),
  unary('exp10', (x) => 10 ** x),
  unary('log', Math.log),
  unary('log2', Math.log2),
  unary('log10', Math.log10),
  unary('log1p', Math.log1p),
  unary('cbrt', Math.cbrt),
]
