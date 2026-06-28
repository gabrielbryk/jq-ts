import { RuntimeError } from '../../errors'
import { describeType } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const transformBuiltins: BuiltinSpec[] = [
  {
    name: 'split',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string') throw new RuntimeError('split input must be a string', span)
      const sepGen = evaluate(args[0]!, input, env, tracker)
      for (const sep of sepGen) {
        if (typeof sep !== 'string')
          throw new RuntimeError('split separator must be a string', span)
        yield emit(input.split(sep), span, tracker)
      }
    },
  },
  {
    name: 'join',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('join input must be an array', span)
      const sepGen = evaluate(args[0]!, input, env, tracker)
      for (const sep of sepGen) {
        if (typeof sep !== 'string') throw new RuntimeError('join separator must be a string', span)
        const parts: string[] = []
        for (const item of input) {
          if (item === null) {
            parts.push('')
          } else if (
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean'
          ) {
            parts.push(String(item))
          } else {
            throw new RuntimeError(`join cannot join ${describeType(item)}`, span)
          }
        }
        yield emit(parts.join(sep), span, tracker)
      }
    },
  },
  {
    name: 'ascii_downcase',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'string') throw new RuntimeError('ascii_downcase expects string', span)
      yield emit(
        input.replace(/[A-Z]/g, (char) => char.toLowerCase()),
        span,
        tracker
      )
    },
  },
  {
    name: 'ascii_upcase',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'string') throw new RuntimeError('ascii_upcase expects string', span)
      yield emit(
        input.replace(/[a-z]/g, (char) => char.toUpperCase()),
        span,
        tracker
      )
    },
  },
]
