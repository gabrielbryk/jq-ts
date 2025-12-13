import { RuntimeError } from '../errors'
import type { BuiltinSpec } from './types'
import { stableStringify } from './utils'

export const errorBuiltins: BuiltinSpec[] = [
  {
    name: 'error',
    arity: 1,
    // eslint-disable-next-line require-yield
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const msg of evaluate(args[0]!, input, env, tracker)) {
        throw new RuntimeError(typeof msg === 'string' ? msg : stableStringify(msg), span)
      }
    },
  },
]
