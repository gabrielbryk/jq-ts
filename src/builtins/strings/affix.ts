import { RuntimeError } from '../../errors'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const affixBuiltins: BuiltinSpec[] = [
  {
    name: 'startswith',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string')
        throw new RuntimeError('startswith input must be a string', span)
      const prefixGen = evaluate(args[0]!, input, env, tracker)
      for (const prefix of prefixGen) {
        if (typeof prefix !== 'string')
          throw new RuntimeError('startswith prefix must be a string', span)
        yield emit(input.startsWith(prefix), span, tracker)
      }
    },
  },
  {
    name: 'endswith',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string') throw new RuntimeError('endswith input must be a string', span)
      const suffixGen = evaluate(args[0]!, input, env, tracker)
      for (const suffix of suffixGen) {
        if (typeof suffix !== 'string')
          throw new RuntimeError('endswith suffix must be a string', span)
        yield emit(input.endsWith(suffix), span, tracker)
      }
    },
  },
  {
    name: 'ltrimstr',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string') throw new RuntimeError('ltrimstr expects string', span)
      const prefixGen = evaluate(args[0]!, input, env, tracker)
      for (const prefix of prefixGen) {
        if (typeof prefix !== 'string')
          throw new RuntimeError('ltrimstr prefix must be a string', span)
        if (input.startsWith(prefix)) {
          yield emit(input.slice(prefix.length), span, tracker)
        } else {
          yield emit(input, span, tracker)
        }
      }
    },
  },
  {
    name: 'rtrimstr',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string') throw new RuntimeError('rtrimstr expects string', span)
      const suffixGen = evaluate(args[0]!, input, env, tracker)
      for (const suffix of suffixGen) {
        if (typeof suffix !== 'string')
          throw new RuntimeError('rtrimstr suffix must be a string', span)
        if (input.endsWith(suffix)) {
          yield emit(input.slice(0, input.length - suffix.length), span, tracker)
        } else {
          yield emit(input, span, tracker)
        }
      }
    },
  },
]
