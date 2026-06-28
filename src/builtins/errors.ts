import { RuntimeError } from '../errors'
import type { BuiltinSpec } from './types'
import { stableStringify } from './utils'

export const errorBuiltins: BuiltinSpec[] = [
  {
    name: 'error',
    arity: 0,
    // error/0 always throws and never yields, so require-yield does not apply.
    // eslint-disable-next-line require-yield
    apply: function* (_input, _args, _env, _tracker, _eval, span) {
      throw new RuntimeError('null', span)
    },
  },
  {
    name: 'error',
    arity: 1,
    // error/1 always throws and never yields, so require-yield does not apply.
    // eslint-disable-next-line require-yield
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const msg of evaluate(args[0]!, input, env, tracker)) {
        throw new RuntimeError(typeof msg === 'string' ? msg : stableStringify(msg), span)
      }
    },
  },
]
