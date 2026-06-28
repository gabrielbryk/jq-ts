import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { fieldsForFormat, fieldsToArray } from './fields'
import { formatStrftime } from './format'
import { readFormat, requireString } from './guards'
import { parseStrptime } from './parse'

/** Factory helpers for the arity-1 string-format date builtins. */

/** `strftime` / `strflocaltime`: format epoch-or-array input per arg format. */
export const strftimeBuiltin = (name: string, utc: boolean): BuiltinSpec => ({
  name,
  arity: 1,
  apply: function* (input, args, env, tracker, evaluate, span) {
    const fields = fieldsForFormat(input, name, span, utc)
    for (const fmt of evaluate(args[0]!, input, env, tracker)) {
      yield emit(formatStrftime(fields, readFormat(fmt, name, span), utc), span, tracker)
    }
  },
})

/** `strptime`: parse string input into a broken-down array per arg format. */
export const strptimeBuiltin = (): BuiltinSpec => ({
  name: 'strptime',
  arity: 1,
  apply: function* (input, args, env, tracker, evaluate, span) {
    const str = requireString(input, 'strptime', span)
    for (const fmt of evaluate(args[0]!, input, env, tracker)) {
      yield emit(
        fieldsToArray(parseStrptime(str, readFormat(fmt, 'strptime', span), span)),
        span,
        tracker
      )
    }
  },
})
