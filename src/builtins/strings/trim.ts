import { RuntimeError } from '../../errors'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const trimBuiltins: BuiltinSpec[] = [
  {
    name: 'trimstr',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string') throw new RuntimeError('trimstr expects string', span)
      for (const trim of evaluate(args[0]!, input, env, tracker)) {
        if (typeof trim !== 'string')
          throw new RuntimeError('trimstr argument must be string', span)
        let result = input
        if (result.startsWith(trim)) result = result.slice(trim.length)
        if (result.endsWith(trim)) result = result.slice(0, result.length - trim.length)
        yield emit(result, span, tracker)
      }
    },
  },
  {
    name: 'trim',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'string') throw new RuntimeError('trim expects string', span)
      yield emit(input.trim(), span, tracker)
    },
  },
  {
    name: 'ltrim',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'string') throw new RuntimeError('ltrim expects string', span)
      yield emit(input.trimStart(), span, tracker)
    },
  },
  {
    name: 'rtrim',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'string') throw new RuntimeError('rtrim expects string', span)
      yield emit(input.trimEnd(), span, tracker)
    },
  },
]
