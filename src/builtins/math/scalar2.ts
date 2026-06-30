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

const binary = (name: string, fn: (x: number, y: number) => number): BuiltinSpec => ({
  name,
  arity: 2,
  apply: function* (input, args, env, tracker, evaluate, span) {
    const ys = Array.from(evaluate(args[1]!, input, env, tracker))
    for (const x of evaluate(args[0]!, input, env, tracker)) {
      for (const y of ys) {
        if (typeof x !== 'number') throw new RuntimeError(`${name} requires numbers`, span)
        if (typeof y !== 'number') throw new RuntimeError(`${name} requires numbers`, span)
        const r = fn(x, y)
        yield emit(Number.isNaN(r) ? null : r, span, tracker)
      }
    }
  },
})

// C fmin/fmax: propagate the non-NaN operand when one is NaN.
const cfmin = (x: number, y: number): number =>
  Number.isNaN(x) ? y : Number.isNaN(y) ? x : Math.min(x, y)
const cfmax = (x: number, y: number): number =>
  Number.isNaN(x) ? y : Number.isNaN(y) ? x : Math.max(x, y)

// copysign: return |x| with the sign of y (negative-zero aware).
const copysign = (x: number, y: number): number =>
  y < 0 || Object.is(y, -0) ? -Math.abs(x) : Math.abs(x)

// fdim: positive difference — max(x - y, 0).
const fdim = (x: number, y: number): number => Math.max(x - y, 0)

export const scalar2Builtins: BuiltinSpec[] = [
  unary('fabs', Math.abs),
  unary('trunc', Math.trunc),
  binary('pow', Math.pow),
  binary('hypot', Math.hypot),
  binary('atan2', Math.atan2),
  binary('fmin', cfmin),
  binary('fmax', cfmax),
  binary('fmod', (x, y) => x % y),
  binary('copysign', copysign),
  binary('fdim', fdim),
]
